// Seller routes - sidebar-counts endpoint is authentication-free (redeploy: 2026-05-30)
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { body, query, validationResult } from 'express-validator';
import axios from 'axios';
import { SellerService } from '../services/SellerService.supabase';
import { EmailService } from '../services/EmailService';
import { authenticate } from '../middleware/auth';
import { CreateSellerRequest, ListSellersParams } from '../types';
import { PropertyDistributionAreaCalculator } from '../services/PropertyDistributionAreaCalculator';
import { CityNameExtractor } from '../services/CityNameExtractor';
import { BuyerService } from '../services/BuyerService';
import { PerformanceMetricsService } from '../services/PerformanceMetricsService';
import { SpreadsheetSyncService } from '../services/SpreadsheetSyncService';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';
import { fetchPopulationData, estimateAreaRatio, fetchTransactionData, fetchPriceData } from '../services/EStatService';

const router = Router();
const sellerService = new SellerService();

// シングルトンインスタンス（キャッシュを維持するため）
const distributionCalculator = new PropertyDistributionAreaCalculator();
const cityExtractor = new CityNameExtractor();

/**
 * SpreadsheetSyncServiceを初期化して返す（Vercelサーバーレス対応）
 * SyncQueueが使えない環境でも直接スプシ同期できるようにする
 */
async function createSpreadsheetSyncService(): Promise<SpreadsheetSyncService | null> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await sheetsClient.authenticate();
    return new SpreadsheetSyncService(sheetsClient, supabase);
  } catch (err) {
    console.error('⚠️ [SpreadsheetSync] Failed to initialize SpreadsheetSyncService:', err);
    return null;
  }
}

// duplicates インメモリキャッシュ（TTL: 60秒）
const duplicatesCache = new Map<string, { data: any[]; expiresAt: number }>();
const DUPLICATES_CACHE_TTL_MS = 60 * 1000;

function getDuplicatesCache(sellerId: string): any[] | null {
  const entry = duplicatesCache.get(sellerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    duplicatesCache.delete(sellerId);
    return null;
  }
  return entry.data;
}

function setDuplicatesCache(sellerId: string, data: any[]): void {
  duplicatesCache.set(sellerId, { data, expiresAt: Date.now() + DUPLICATES_CACHE_TTL_MS });
}

function invalidateDuplicatesCache(sellerId: string): void {
  duplicatesCache.delete(sellerId);
}

// 認証不要のエンドポイントを先に定義

/**
 * employeesテーブルから「名前→イニシャル」の正規化関数を構築する
 * - 全角→半角変換
 * - 小文字→大文字変換
 * - 氏名フル（例: 国広智子）→ イニシャル（K）への変換
 * 上記全ての表記揺れを統一してランキング集計に使用する
 */
async function buildNormalizeInitialMap(supabase: any): Promise<(raw: string) => string> {
  try {
    const { data: employees } = await supabase
      .from('employees')
      .select('initials, name')
      .not('initials', 'is', null);

    // 名前→イニシャルのマップ（例: "国広智子" → "K"）
    const nameToInitial = new Map<string, string>();
    // イニシャルの正規化マップ（例: "ｗ" → "W", "k" → "K"）
    const normalizedInitials = new Map<string, string>();

    for (const emp of employees || []) {
      const initial: string = emp.initials ? String(emp.initials).trim() : '';
      const name: string = emp.name ? String(emp.name).trim() : '';
      if (!initial) continue;

      // 名前→イニシャル
      if (name) {
        nameToInitial.set(name, initial);
      }

      // 全角英字→半角 / 小文字→大文字 の正規化マップを登録
      const halfWidth = initial
        .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      const upper = halfWidth.toUpperCase();
      // 全角版・小文字版→正規イニシャルに対応付け
      if (halfWidth !== initial) normalizedInitials.set(initial, upper);
      if (upper !== initial && upper !== halfWidth) normalizedInitials.set(halfWidth.toLowerCase(), upper);
      normalizedInitials.set(initial.toLowerCase(), upper);
      normalizedInitials.set(halfWidth, upper);
      normalizedInitials.set(upper, upper); // 自分自身も登録
    }

    return (raw: string): string => {
      const trimmed = raw.trim();

      // 1. 名前（フル）→イニシャル変換（例: 国広智子 → K）
      if (nameToInitial.has(trimmed)) {
        return nameToInitial.get(trimmed)!;
      }

      // 2. 全角・小文字等の表記揺れ正規化
      // まず全角→半角変換してから大文字化
      const halfWidth = trimmed.replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      const upper = halfWidth.toUpperCase();
      if (normalizedInitials.has(upper)) {
        return normalizedInitials.get(upper)!;
      }
      if (normalizedInitials.has(trimmed)) {
        return normalizedInitials.get(trimmed)!;
      }

      // 3. マッチしない場合は変換結果をそのまま返す（未知の値はそのまま）
      return upper || trimmed;
    };
  } catch (err) {
    console.error('[buildNormalizeInitialMap] エラー:', err);
    // エラー時はそのまま返す関数
    return (raw: string) => raw.trim();
  }
}

/**
 * サイドバー用の売主カテゴリカウントを取得
 * 各カテゴリの条件に合う売主のみを取得してカウント
 */
router.get('/sidebar-counts', async (req: Request, res: Response) => {
  try {
    const counts = await sellerService.getSidebarCounts();
    res.json(counts);
  } catch (error) {
    console.error('Get sidebar counts error:', error);
    res.status(500).json({
      error: {
        code: 'SIDEBAR_COUNTS_ERROR',
        message: 'Failed to get sidebar counts',
        retryable: true,
      },
    });
  }
});

/**
 * seller_sidebar_countsテーブルを更新（認証不要・cron用）
 * 10分ごとにVercel Cronから呼び出される
 */
// Vercel CronはGETリクエストを送信するため、GETとPOSTの両方に対応
router.get('/sidebar-counts/update', async (req: Request, res: Response) => {
  try {
    const { SellerSidebarCountsUpdateService } = await import('../services/SellerSidebarCountsUpdateService');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const updateService = new SellerSidebarCountsUpdateService(supabase);
    await updateService.updateSellerSidebarCounts();
    res.json({ success: true, message: 'Seller sidebar counts updated successfully' });
  } catch (error) {
    console.error('Update seller sidebar counts error:', error);
    res.status(500).json({ error: { code: 'UPDATE_SIDEBAR_COUNTS_ERROR', message: 'Failed to update seller sidebar counts', retryable: true } });
  }
});

router.post('/sidebar-counts/update', async (req: Request, res: Response) => {
  try {
    // Vercel Cronからの呼び出しを検証（オプション）
    // 一時的に認証を無効化（初回データ投入のため）
    // const authHeader = req.headers.authorization;
    // const cronSecret = process.env.CRON_SECRET;
    
    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   return res.status(401).json({
    //     error: {
    //       code: 'UNAUTHORIZED',
    //       message: 'Invalid authorization',
    //       retryable: false,
    //     },
    //   });
    // }

    const { SellerSidebarCountsUpdateService } = await import('../services/SellerSidebarCountsUpdateService');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const updateService = new SellerSidebarCountsUpdateService(supabase);
    
    await updateService.updateSellerSidebarCounts();
    
    res.json({ success: true, message: 'Seller sidebar counts updated successfully' });
  } catch (error) {
    console.error('Update seller sidebar counts error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_SIDEBAR_COUNTS_ERROR',
        message: 'Failed to update seller sidebar counts',
        retryable: true,
      },
    });
  }
});

// 全てのルートに認証を適用（sidebar-countsの後に配置）
// ↓ backfill-call-logは認証不要のためここより前に定義
router.post('/backfill-call-log', async (req: Request, res: Response) => {
  try {
    const fromDate = (req.body?.from as string) || '2026-04-13T00:00:00+09:00';
    console.log(`[BackfillCallLog] Starting backfill from ${fromDate}`);

    const supabase = (await import('../config/supabase')).default;
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
      sheetName: '売主追客ログ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await sheetsClient.authenticate();

    const rawData = await sheetsClient.readRawRange('A:C');
    const headers = rawData[0] || [];
    const keyIdx = headers.findIndex((h: string) => h === '売主追客ログID');
    console.log(`[BackfillCallLog] Headers: ${JSON.stringify(headers)}, keyIdx=${keyIdx}`);

    // keyIdxが見つからない場合はB列(index=1)をデフォルトとして使用
    const effectiveKeyIdx = keyIdx >= 0 ? keyIdx : 1;

    const existingKeys = new Set<string>();
    for (let i = 1; i < rawData.length; i++) {
      const key = rawData[i][effectiveKeyIdx];
      if (key) existingKeys.add(String(key).trim());
    }
    console.log(`[BackfillCallLog] effectiveKeyIdx=${effectiveKeyIdx}, Existing keys: ${existingKeys.size}, samples: ${JSON.stringify([...existingKeys].slice(-5))}`);

    const { data: activities, error } = await supabase
      .from('activities')
      .select(`id, seller_id, created_at, employees:employee_id (id, name, initials)`)
      .eq('type', 'phone_call')
      .gte('created_at', fromDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    console.log(`[BackfillCallLog] DB activities found: ${activities?.length ?? 0}`);

    const sellerIds = [...new Set((activities || []).map((a: any) => a.seller_id))];
    const { data: sellers } = await supabase
      .from('sellers').select('id, seller_number').in('id', sellerIds);

    const sellerMap = new Map<string, string>();
    for (const s of sellers || []) sellerMap.set(s.id, s.seller_number);

    let written = 0, skipped = 0, failed = 0;

    for (const activity of activities || []) {
      const shortId = activity.id.substring(0, 8);
      if (existingKeys.has(shortId)) { skipped++; continue; }

      const sellerNumber = sellerMap.get(activity.seller_id);
      if (!sellerNumber) { failed++; continue; }

      const emp = (activity as any).employees;
      const initials = emp?.initials || emp?.name || '?';
      const jstDate = new Date(new Date(activity.created_at).getTime() + 9 * 60 * 60 * 1000);
      const jstDateString = jstDate.toISOString().replace('T', ' ').substring(0, 19);

      try {
        await sheetsClient.appendRow({
          '日付': jstDateString,
          '売主追客ログID': shortId,
          '売主番号': sellerNumber,
          '担当（前半）': initials,
        });
        console.log(`[BackfillCallLog] ✅ ${sellerNumber} by ${initials} at ${jstDateString}`);
        written++;
        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        console.error(`[BackfillCallLog] ❌ ${sellerNumber}: ${err.message}`);
        failed++;
      }
    }

    console.log(`[BackfillCallLog] Done. written=${written}, skipped=${skipped}, failed=${failed}`);
    res.json({ success: true, written, skipped, failed, total: (activities || []).length });
  } catch (error: any) {
    console.error('[BackfillCallLog] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});







// 全てのルートに認証を適用（sidebar-countsの後に配置）
router.use(authenticate);

/**
 * 売主を登録
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('property').notEmpty().withMessage('Property information is required'),
    body('property.address').notEmpty().withMessage('Property address is required'),
    body('property.prefecture').optional().isString().withMessage('Prefecture must be a string'),
    body('property.city').optional().isString().withMessage('City must be a string'),
    body('property.propertyType').notEmpty().withMessage('Property type is required'),
    // Phase 1 validations (all optional for now)
    body('inquirySource').optional().isString().withMessage('Inquiry source must be a string'),
    body('inquiryYear').optional().isInt({ min: 2000, max: 2100 }).withMessage('Inquiry year must be a valid year'),
    body('inquiryDate').optional().isISO8601().withMessage('Inquiry date must be a valid date'),
    body('inquiryDatetime').optional().isISO8601().withMessage('Inquiry datetime must be a valid datetime'),
    body('confidenceLevel').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid confidence level'),
    body('firstCallerInitials').optional().isString().withMessage('First caller initials must be a string'),
    body('sellerNumber').optional().matches(/^(AA|FI)\d+$/).withMessage('Seller number must be in format AA{number} or FI{number}'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const data: CreateSellerRequest = req.body;
      const result = await sellerService.createSeller(data, req.employee!.id);

      // Phase 1: Return with duplicate warning if applicable
      res.status(201).json(result);
    } catch (error) {
      console.error('Create seller error:', error);
      res.status(500).json({
        error: {
          code: 'CREATE_SELLER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create seller',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 売主リストを取得
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('pageSize').optional().isInt({ min: 1, max: 9999 }).withMessage('Page size must be between 1 and 9999'),
    // Phase 1 filter validations
    query('inquirySource').optional().isString().withMessage('Inquiry source must be a string'),
    query('inquiryYearFrom').optional().isInt({ min: 2000 }).withMessage('Inquiry year from must be a valid year'),
    query('inquiryYearTo').optional().isInt({ min: 2000 }).withMessage('Inquiry year to must be a valid year'),
    query('isUnreachable').optional().isBoolean().withMessage('Is unreachable must be a boolean'),
    query('confidenceLevel').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid confidence level'),
    query('firstCaller').optional().isString().withMessage('First caller must be a string'),
    query('duplicateConfirmed').optional().isBoolean().withMessage('Duplicate confirmed must be a boolean'),
    query('valuationNotRequired').optional().isBoolean().withMessage('Valuation not required must be a boolean'),
    query('inquirySite').optional().isString().withMessage('Inquiry site must be a string'),
    query('propertyType').optional().isString().withMessage('Property type must be a string'),
    query('statusFilter').optional().isString().withMessage('Status filter must be a string'),
    // サイドバーカテゴリフィルター（visitAssigned:xxx, todayCallAssigned:xxx の動的カテゴリも許可）
    query('statusCategory').optional().isString().withMessage('Invalid status category'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const params: ListSellersParams = {
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 50,
        status: req.query.status as any,
        assignedTo: req.query.assignedTo as string,
        nextCallDateFrom: req.query.nextCallDateFrom ? new Date(req.query.nextCallDateFrom as string) : undefined,
        nextCallDateTo: req.query.nextCallDateTo ? new Date(req.query.nextCallDateTo as string) : undefined,
        sortBy: (req.query.sortBy as string) || 'created_at',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
        // Phase 1 filters
        inquirySource: req.query.inquirySource as string,
        inquiryYearFrom: req.query.inquiryYearFrom ? parseInt(req.query.inquiryYearFrom as string) : undefined,
        inquiryYearTo: req.query.inquiryYearTo ? parseInt(req.query.inquiryYearTo as string) : undefined,
        isUnreachable: req.query.isUnreachable === 'true' ? true : req.query.isUnreachable === 'false' ? false : undefined,
        confidenceLevel: req.query.confidenceLevel as any,
        firstCaller: req.query.firstCaller as string,
        duplicateConfirmed: req.query.duplicateConfirmed === 'true' ? true : req.query.duplicateConfirmed === 'false' ? false : undefined,
        valuationNotRequired: req.query.valuationNotRequired === 'true' ? true : req.query.valuationNotRequired === 'false' ? false : undefined,
        inquirySite: req.query.inquirySite as string,
        propertyType: req.query.propertyType as string,
        statusFilter: req.query.statusFilter as string,
        // サイドバーカテゴリフィルター
        statusCategory: req.query.statusCategory as any,
      };

      const result = await sellerService.listSellers(params);
      res.json(result);
    } catch (error) {
      console.error('List sellers error:', error);
      res.status(500).json({
        error: {
          code: 'LIST_SELLERS_ERROR',
          message: 'Failed to list sellers',
          retryable: true,
        },
      });
    }
  }
);

/**
 * 担当者（visit_assignee）のユニーク一覧を取得
 * サイドバーの担当者別カテゴリー表示用
 */
router.get('/assignee-initials', async (req: Request, res: Response) => {
  try {
    const initials = await sellerService.getUniqueAssigneeInitials();
    res.json({ initials });
  } catch (error) {
    console.error('Get assignee initials error:', error);
    res.status(500).json({
      error: {
        code: 'GET_ASSIGNEE_INITIALS_ERROR',
        message: 'Failed to get assignee initials',
        retryable: true,
      },
    });
  }
});

/**
 * 次の売主番号を取得
 * 連番シート（ID: 19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs）のC2セル（AA用）またはD2セル（FI用）を読み取り、
 * プレフィックス + (n + 1) 形式で返す
 */
router.get('/next-seller-number', async (req: Request, res: Response) => {
  try {
    const prefix = (req.query.prefix as string || 'AA').toUpperCase();
    const cell = prefix === 'FI' ? 'I2' : 'C2';

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await sheetsClient.authenticate();
    const values = await sheetsClient.readRawRange(cell);
    const c2Value = values?.[0]?.[0];
    if (c2Value === undefined || c2Value === null || c2Value === '') {
      return res.status(500).json({
        error: {
          code: 'NEXT_SELLER_NUMBER_ERROR',
          message: `連番シート${cell}の読み取りに失敗しました`,
          retryable: true,
        },
      });
    }
    const n = parseInt(String(c2Value), 10);
    if (isNaN(n)) {
      return res.status(500).json({
        error: {
          code: 'NEXT_SELLER_NUMBER_ERROR',
          message: `連番シート${cell}の値が数値ではありません`,
          retryable: false,
        },
      });
    }
    const sellerNumber = prefix + String(n + 1);
    res.json({ sellerNumber });
  } catch (error) {
    console.error('Get next seller number error:', error);
    res.status(500).json({
      error: {
        code: 'NEXT_SELLER_NUMBER_ERROR',
        message: error instanceof Error ? error.message : '次の売主番号の取得に失敗しました',
        retryable: true,
      },
    });
  }
});

/**
 * 売主を検索
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    console.log('🔍 Search endpoint called with query:', query);

    if (!query) {
      console.log('❌ No query provided');
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required',
          retryable: false,
        },
      });
    }

    console.log('📞 Calling sellerService.searchSellers...');
    const sellers = await sellerService.searchSellers(query);
    console.log(`✅ Search completed, returning ${sellers.length} sellers`);
    res.json(sellers);
  } catch (error) {
    console.error('❌ Search sellers error:', error);
    res.status(500).json({
      error: {
        code: 'SEARCH_SELLERS_ERROR',
        message: 'Failed to search sellers',
        retryable: true,
      },
    });
  }
});

/**
 * 訪問統計を取得
 * GET /api/sellers/visit-stats?month=2024-12
 */
router.get('/visit-stats', async (req: Request, res: Response) => {
  try {
    console.log('📊 Visit stats endpoint called');
    console.log('Query params:', req.query);
    
    const { month } = req.query;
    
    // monthパラメータがない場合は現在の月を使用
    const targetMonth = month ? String(month) : new Date().toISOString().slice(0, 7);
    
    console.log('Target month:', targetMonth);
    
    const stats = await sellerService.getVisitStats(targetMonth);
    
    console.log('Stats result:', stats);
    
    res.json(stats);
  } catch (error) {
    console.error('Get visit stats error:', error);
    res.status(500).json({
      error: {
        code: 'VISIT_STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get visit stats',
        retryable: true,
      },
    });
  }
});

/**
 * 1番電話ランキングを取得
 * GET /api/sellers/call-ranking
 * 指定月（またはJST当月）の first_call_person 件数をスタッフ別に集計して返す
 * クエリパラメータ: year（年）, month（月、1-12）
 */
router.get('/call-ranking', async (req: Request, res: Response) => {
  try {
    // クエリパラメータから年月を取得（指定がなければ当月）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = req.query.year ? parseInt(req.query.year as string, 10) : jstNow.getUTCFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) - 1 : jstNow.getUTCMonth(); // 0-indexed

    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const supabase = (await import('../config/supabase')).default;

    // employeesテーブルから名前→イニシャルの正規化マップを取得
    const normalizeInitial = await buildNormalizeInitialMap(supabase);

    const { data, error } = await supabase
      .from('sellers')
      .select('first_call_person')
      .gte('inquiry_date', fromDate)
      .lte('inquiry_date', toDate)
      .not('first_call_person', 'is', null)
      .neq('first_call_person', '')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    // アプリ側で集計（正規化済みイニシャルでカウント）
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const raw = (row.first_call_person as string).trim();
      const initial = normalizeInitial(raw);
      counts.set(initial, (counts.get(initial) || 0) + 1);
    }

    // count DESC, initial ASC でソート
    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    res.json({
      period: { from: fromDate, to: toDate },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get call ranking error:', error);
    res.status(500).json({
      error: {
        code: 'CALL_RANKING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get call ranking',
        retryable: true,
      },
    });
  }
});

/**
 * 1番電話年間累計ランキングを取得
 * GET /api/sellers/call-ranking-yearly
 * 2026年1月1日から現在までの first_call_person 件数をスタッフ別に集計して返す
 */
router.get('/call-ranking-yearly', async (req: Request, res: Response) => {
  try {
    const fromDate = '2026-01-01';

    // JSTで今日の日付を計算
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const supabase = (await import('../config/supabase')).default;

    // employeesテーブルから名前→イニシャルの正規化マップを取得
    const normalizeInitial = await buildNormalizeInitialMap(supabase);

    const { data, error } = await supabase
      .from('sellers')
      .select('first_call_person')
      .gte('inquiry_date', fromDate)
      .lte('inquiry_date', toDate)
      .not('first_call_person', 'is', null)
      .neq('first_call_person', '')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    // アプリ側で集計（正規化済みイニシャルでカウント）
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const raw = (row.first_call_person as string).trim();
      const initial = normalizeInitial(raw);
      counts.set(initial, (counts.get(initial) || 0) + 1);
    }

    // count DESC, initial ASC でソート
    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    res.json({
      period: { from: fromDate, to: toDate },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get call ranking yearly error:', error);
    res.status(500).json({
      error: {
        code: 'CALL_RANKING_YEARLY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get yearly call ranking',
        retryable: true,
      },
    });
  }
});

/**
 * 訪問予約者月間ランキングを取得
 * GET /api/sellers/visit-ranking
 * 当月（JST）の visit_valuation_acquirer 件数をスタッフ別に集計して返す
 */
router.get('/visit-ranking', async (req: Request, res: Response) => {
  try {
    // JSTで当月の開始日・終了日を計算
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth(); // 0-indexed

    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const supabase = (await import('../config/supabase')).default;

    // employeesテーブルから名前→イニシャルの正規化マップを取得
    const normalizeInitial = await buildNormalizeInitialMap(supabase);

    const { data, error } = await supabase
      .from('sellers')
      .select('visit_valuation_acquirer')
      .gte('visit_acquisition_date', fromDate)
      .lte('visit_acquisition_date', toDate)
      .not('visit_valuation_acquirer', 'is', null)
      .neq('visit_valuation_acquirer', '')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    // アプリ側で集計（正規化済みイニシャルでカウント）
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const raw = (row.visit_valuation_acquirer as string).trim();
      const initial = normalizeInitial(raw);
      counts.set(initial, (counts.get(initial) || 0) + 1);
    }

    // count DESC, initial ASC でソート
    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    res.json({
      period: { from: fromDate, to: toDate },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get visit ranking error:', error);
    res.status(500).json({
      error: {
        code: 'VISIT_RANKING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get visit ranking',
        retryable: true,
      },
    });
  }
});

/**
 * 訪問予約者年間累計ランキングを取得
 * GET /api/sellers/visit-ranking-yearly
 * 2026年1月1日から現在までの visit_valuation_acquirer 件数をスタッフ別に集計して返す
 */
router.get('/visit-ranking-yearly', async (req: Request, res: Response) => {
  try {
    const fromDate = '2026-01-01';

    // JSTで今日の日付を計算
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const supabase = (await import('../config/supabase')).default;

    // employeesテーブルから名前→イニシャルの正規化マップを取得
    const normalizeInitial = await buildNormalizeInitialMap(supabase);

    const { data, error } = await supabase
      .from('sellers')
      .select('visit_valuation_acquirer')
      .gte('visit_acquisition_date', fromDate)
      .lte('visit_acquisition_date', toDate)
      .not('visit_valuation_acquirer', 'is', null)
      .neq('visit_valuation_acquirer', '')
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    // アプリ側で集計（正規化済みイニシャルでカウント）
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const raw = (row.visit_valuation_acquirer as string).trim();
      const initial = normalizeInitial(raw);
      counts.set(initial, (counts.get(initial) || 0) + 1);
    }

    // count DESC, initial ASC でソート
    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    res.json({
      period: { from: fromDate, to: toDate },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get visit ranking yearly error:', error);
    res.status(500).json({
      error: {
        code: 'VISIT_RANKING_YEARLY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get yearly visit ranking',
        retryable: true,
      },
    });
  }
});

/**
 * 追客電話ランキングを取得
 * GET /api/sellers/call-tracking-ranking
 * Google Spreadsheet「売主追客ログ」から指定月（または当月）のデータを集計してランキングを返す
 * クエリパラメータ: year（年）, month（月、1-12）
 */
router.get('/call-tracking-ranking', async (req: Request, res: Response) => {
  try {
    // クエリパラメータから年月を取得（指定がなければ当月）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = req.query.year ? parseInt(req.query.year as string, 10) : jstNow.getUTCFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) - 1 : jstNow.getUTCMonth(); // 0-indexed

    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Google Sheets APIでデータ取得（レート制限付き）
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const { sheetsRateLimiter } = await import('../services/RateLimiter');
    
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
      sheetName: '売主追客ログ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });

    await sheetsClient.authenticate();

    // レート制限を適用してデータ取得（A列からG列まで広めに取得）
    const rawData = await sheetsRateLimiter.executeRequest(async () => {
      return await sheetsClient.readRawRange('A:G');
    });

    if (!rawData || rawData.length === 0) {
      return res.json({
        period: { from: fromDate, to: toDate },
        rankings: [],
        updatedAt: new Date().toISOString(),
      });
    }

    // ヘッダー行からインデックスを動的に取得
    const headers = rawData[0];
    const dateColIdx = headers.findIndex((h: string) => h === '日付');
    const firstHalfColIdx = headers.findIndex((h: string) => h === '担当（前半）');
    const secondHalfColIdx = headers.findIndex((h: string) => h === '担当（後半）');

    console.log(`[CallTrackingRanking] Column indices - 日付:${dateColIdx}, 担当（前半）:${firstHalfColIdx}, 担当（後半）:${secondHalfColIdx}`);
    console.log(`[CallTrackingRanking] Headers: ${JSON.stringify(headers)}`);

    // ヘッダーが見つからない場合はデフォルト値を使用
    const effectiveDateIdx = dateColIdx >= 0 ? dateColIdx : 0;
    const effectiveFirstHalfIdx = firstHalfColIdx >= 0 ? firstHalfColIdx : 4;
    const effectiveSecondHalfIdx = secondHalfColIdx >= 0 ? secondHalfColIdx : 5;

    // ヘッダー行をスキップ
    const dataRows = rawData.slice(1);

    // 当月のデータをフィルタリングしてイニシャルを集計
    const counts = new Map<string, number>();
    const currentMonthStart = new Date(year, month, 1);
    const currentMonthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // employeesテーブルから名前→イニシャルの正規化マップを取得
    const supabaseForNormalize = (await import('../config/supabase')).default;
    const normalizeInitial = await buildNormalizeInitialMap(supabaseForNormalize);

    for (const row of dataRows) {
      const dateStr = row[effectiveDateIdx]; // 日付列
      const initial1 = row[effectiveFirstHalfIdx]; // 担当（前半）列
      const initial2 = row[effectiveSecondHalfIdx]; // 担当（後半）列

      // 日付が空欄の場合はスキップ
      if (!dateStr) continue;

      // 日付を解析（JSTローカル時刻として扱う）
      let date: Date;
      try {
        const dateStrNorm = String(dateStr).trim();
        // "2026/4/15" または "2026/4/15 10:30:00" 形式
        const slashParts = dateStrNorm.split('/');
        if (slashParts.length >= 3) {
          const y = parseInt(slashParts[0], 10);
          const m = parseInt(slashParts[1], 10) - 1;
          const dayPart = slashParts[2].split(' ')[0]; // 時刻部分を除去
          const d = parseInt(dayPart, 10);
          date = new Date(y, m, d);
        } else {
          // "2026-04-28 10:30:00" または "2026-04-28T10:30:00" 形式
          // 日付部分のみ取り出してローカル時刻として解釈
          const datePart = dateStrNorm.substring(0, 10); // "2026-04-28"
          const [y, m, d] = datePart.split('-').map(Number);
          date = new Date(y, m - 1, d);
        }

        // 無効な日付はスキップ
        if (isNaN(date.getTime())) {
          console.warn(`[CallTrackingRanking] Invalid date format: ${dateStr}`);
          continue;
        }
      } catch (error) {
        console.warn(`[CallTrackingRanking] Failed to parse date: ${dateStr}`, error);
        continue;
      }

      // 当月のデータのみを対象
      if (date < currentMonthStart || date > currentMonthEnd) {
        continue;
      }

      // E列のイニシャルをカウント
      if (initial1 && String(initial1).trim() !== '') {
        const initial = normalizeInitial(String(initial1).trim());
        counts.set(initial, (counts.get(initial) || 0) + 1);
      }

      // F列のイニシャルをカウント
      if (initial2 && String(initial2).trim() !== '') {
        const initial = normalizeInitial(String(initial2).trim());
        counts.set(initial, (counts.get(initial) || 0) + 1);
      }
    }

    // count DESC, initial ASC でソート
    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    console.log(`[CallTrackingRanking] Successfully fetched ranking data (${rankings.length} entries)`);

    res.json({
      period: { from: fromDate, to: toDate },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CallTrackingRanking] Error:', error);
    res.status(500).json({
      error: {
        code: 'CALL_TRACKING_RANKING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get call tracking ranking',
        retryable: true,
      },
    });
  }
});

/**
 * パフォーマンスメトリクスを取得
 * GET /api/sellers/performance-metrics?month=2024-12
 */
router.get('/performance-metrics', [
  query('month').notEmpty().withMessage('Month is required').matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'INVALID_MONTH_FORMAT',
          message: 'Month must be in YYYY-MM format',
          retryable: false,
        },
      });
    }

    const { month } = req.query;
    const performanceMetricsService = new PerformanceMetricsService();
    
    // 拡張メトリクス（月平均を含む）を返す
    const metrics = await performanceMetricsService.calculateEnhancedMetrics(month as string);
    
    res.json(metrics);
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({
      error: {
        code: 'CALCULATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to calculate performance metrics',
        retryable: true,
      },
    });
  }
});

/**
 * 売主番号（AA12345形式）で売主の名前・住所を取得（軽量エンドポイント）
 * GET /api/sellers/by-number/:sellerNumber
 */
router.get('/by-number/:sellerNumber', async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('sellers')
      .select('id, seller_number, name, property_address')
      .eq('seller_number', sellerNumber)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // name は暗号化されている可能性があるため SellerService 経由で取得
    const seller = await sellerService.getSeller(data.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // sellers テーブルから座標を直接取得
    const { data: sellerRaw } = await supabase
      .from('sellers')
      .select('latitude, longitude')
      .eq('seller_number', sellerNumber)
      .single();

    let latitude: number | null = sellerRaw?.latitude ?? null;
    let longitude: number | null = sellerRaw?.longitude ?? null;

    // 座標がない場合、バックエンドでジオコーディングして取得・保存
    if ((latitude == null || longitude == null) && seller.propertyAddress) {
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const { GeocodingService } = await import('../services/GeocodingService');
          const geocodingService = new GeocodingService();
          const sellerPrefix = sellerNumber ? sellerNumber.substring(0, 2).toUpperCase() : undefined;
          const coords = await geocodingService.geocodeAddress(seller.propertyAddress, sellerPrefix);
          if (coords) {
            latitude = coords.lat;
            longitude = coords.lng;
            // sellers テーブルに座標を保存（次回から高速化）
            await supabase
              .from('sellers')
              .update({ latitude: coords.lat, longitude: coords.lng })
              .eq('seller_number', sellerNumber);
          } else {
            console.warn(`[by-number] Geocoding returned null for address: ${seller.propertyAddress}`);
          }
        } else {
          console.warn('[by-number] GOOGLE_MAPS_API_KEY is not set, skipping geocoding');
        }
      } catch (geocodeError) {
        console.error('[by-number] Geocoding error:', geocodeError);
      }
    }

    res.json({
      id: seller.id,
      sellerNumber: seller.sellerNumber,
      name: seller.name,
      propertyAddress: seller.propertyAddress,
      address: seller.address,
      phoneNumber: seller.phoneNumber,
      email: seller.email,
      visitDate: seller.visitDate,
      visitAssignee: seller.visitAssignee,
      latitude,
      longitude,
    });
  } catch (error) {
    console.error('Get seller by number error:', error);
    res.status(500).json({ error: 'Failed to get seller' });
  }
});

/**
 * 売主番号で座標を更新
 * PATCH /api/sellers/by-number/:sellerNumber
 */
router.patch('/by-number/:sellerNumber', async (req: Request, res: Response) => {
  try {
    const { sellerNumber } = req.params;
    const { latitude, longitude } = req.body;

    // バリデーション
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude must be numbers' });
    }

    // 座標の範囲チェック（日本の範囲内）
    if (latitude < 20 || latitude > 46 || longitude < 122 || longitude > 154) {
      return res.status(400).json({ error: 'Invalid coordinates for Japan' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 売主が存在するか確認
    const { data: seller, error: fetchError } = await supabase
      .from('sellers')
      .select('id, seller_number')
      .eq('seller_number', sellerNumber)
      .single();

    if (fetchError || !seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 座標を更新
    const { error: updateError } = await supabase
      .from('sellers')
      .update({
        latitude,
        longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('seller_number', sellerNumber);

    if (updateError) {
      console.error('Update coordinates error:', updateError);
      return res.status(500).json({ error: 'Failed to update coordinates' });
    }

    res.json({
      success: true,
      sellerNumber,
      latitude,
      longitude,
    });
  } catch (error) {
    console.error('Update seller coordinates by number error:', error);
    res.status(500).json({ error: 'Failed to update seller coordinates' });
  }
});

/**
 * 売主の座標を property_listings テーブルに保存
 * PATCH /api/sellers/:id/coordinates
 */
router.patch('/:id/coordinates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    // seller_number を取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('seller_number')
      .eq('id', id)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // property_listings テーブルの座標を更新
    const { error: updateError } = await supabase
      .from('property_listings')
      .update({ latitude, longitude, updated_at: new Date().toISOString() })
      .eq('property_number', seller.seller_number);

    if (updateError) {
      console.error('Update coordinates error:', updateError);
      return res.status(500).json({ error: 'Failed to update coordinates' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Patch coordinates error:', error);
    res.status(500).json({ error: 'Failed to update coordinates' });
  }
});

/**
 * 売主情報を取得
 */
router.get('/:id', async (req: Request, res: Response) => {
  const t0 = Date.now();
  console.log(`[PERF] GET /api/sellers/${req.params.id} start`);
  try {
    const seller = await sellerService.getSeller(req.params.id);
    const t1 = Date.now();
    console.log(`[PERF] getSeller done: ${t1 - t0}ms`);
    
    // デバッグ: inquiry_idの値を確認
    console.log(`[DEBUG] seller.inquiryId: ${seller?.inquiryId}, seller.inquirySite: ${seller?.inquirySite}`);

    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }

    res.json(seller);
    console.log(`[PERF] GET /api/sellers/${req.params.id} total: ${Date.now() - t0}ms`);
  } catch (error) {
    console.error('Get seller error:', error);
    res.status(500).json({
      error: {
        code: 'GET_SELLER_ERROR',
        message: 'Failed to get seller',
        retryable: true,
      },
    });
  }
});

/**
 * 売主の重複案件を取得
 */
router.get('/:id/duplicates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // キャッシュ確認（60秒TTL）
    const cached = getDuplicatesCache(id);
    if (cached) {
      return res.json({ duplicates: cached });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 対象売主のハッシュを取得
    const { data: rawSeller, error: rawError } = await supabase
      .from('sellers')
      .select('id, phone_number_hash, email_hash')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (rawError || !rawSeller) {
      return res.status(404).json({
        error: { code: 'SELLER_NOT_FOUND', message: 'Seller not found', retryable: false },
      });
    }

    const { phone_number_hash, email_hash } = rawSeller;

    if (!phone_number_hash && !email_hash) {
      return res.json({ duplicates: [] });
    }

    // ハッシュ同士で比較（インデックスが効くため高速）
    const matchMap = new Map<string, any>();

    // 電話番号ハッシュで検索
    if (phone_number_hash) {
      const { data: phoneMatches } = await supabase
        .from('sellers')
        .select('id, seller_number, name, phone_number, email, inquiry_date, confidence_level, status, next_call_date, valuation_amount_1, valuation_amount_2, valuation_amount_3, property_address, comments')
        .eq('phone_number_hash', phone_number_hash)
        .neq('id', id)
        .is('deleted_at', null);

      if (phoneMatches) {
        const { decrypt } = await import('../utils/encryption');
        for (const seller of phoneMatches) {
          let decryptedName = '';
          try { decryptedName = seller.name ? decrypt(seller.name) : ''; } catch { /* skip */ }
          matchMap.set(seller.id, {
            sellerId: seller.id,
            matchType: 'phone' as const,
            sellerInfo: {
              name: decryptedName,
              phoneNumber: '',
              inquiryDate: seller.inquiry_date ? new Date(seller.inquiry_date) : undefined,
              sellerNumber: seller.seller_number,
              confidenceLevel: seller.confidence_level,
              status: seller.status,
              nextCallDate: seller.next_call_date,
              valuationAmount1: seller.valuation_amount_1,
              valuationAmount2: seller.valuation_amount_2,
              valuationAmount3: seller.valuation_amount_3,
              propertyAddress: seller.property_address,
              comments: seller.comments,
            },
            propertyInfo: seller.property_address ? { address: seller.property_address, propertyType: '' } : undefined,
          });
        }
      }
    }

    // メールハッシュで検索
    if (email_hash) {
      const { data: emailMatches } = await supabase
        .from('sellers')
        .select('id, seller_number, name, phone_number, email, inquiry_date, confidence_level, status, next_call_date, valuation_amount_1, valuation_amount_2, valuation_amount_3, property_address, comments')
        .eq('email_hash', email_hash)
        .neq('id', id)
        .is('deleted_at', null);

      if (emailMatches) {
        const { decrypt } = await import('../utils/encryption');
        for (const seller of emailMatches) {
          if (matchMap.has(seller.id)) {
            matchMap.get(seller.id).matchType = 'both';
          } else {
            let decryptedName = '';
            try { decryptedName = seller.name ? decrypt(seller.name) : ''; } catch { /* skip */ }
            matchMap.set(seller.id, {
              sellerId: seller.id,
              matchType: 'email' as const,
              sellerInfo: {
                name: decryptedName,
                phoneNumber: '',
                inquiryDate: seller.inquiry_date ? new Date(seller.inquiry_date) : undefined,
                sellerNumber: seller.seller_number,
                confidenceLevel: seller.confidence_level,
                status: seller.status,
                nextCallDate: seller.next_call_date,
                valuationAmount1: seller.valuation_amount_1,
                valuationAmount2: seller.valuation_amount_2,
                valuationAmount3: seller.valuation_amount_3,
                propertyAddress: seller.property_address,
                comments: seller.comments,
              },
              propertyInfo: seller.property_address ? { address: seller.property_address, propertyType: '' } : undefined,
            });
          }
        }
      }
    }

    const duplicates = Array.from(matchMap.values());
    setDuplicatesCache(id, duplicates);
    res.json({ duplicates });
  } catch (error) {
    console.error('Get duplicates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get duplicates',
        retryable: true,
      },
    });
  }
});

// Valid site options
const VALID_SITE_OPTIONS = [
  'ウ',
  'ビ',
  'H',
  'お',
  'Y',
  'す',
  'a',
  'L',
  'エ',
  '近所',
  'チ',
  'P',
  '紹',
  'リ',
  '買',
  'HP',
  '知合',
  'at-homeの掲載を見て',
  '2件目以降査定'
];

/**
 * 売主情報を更新
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    console.log('📝 Update seller request:', {
      sellerId: req.params.id,
      body: req.body,
    });
    
    // Validate site field if provided
    if (req.body.site !== undefined && req.body.site !== null) {
      if (!VALID_SITE_OPTIONS.includes(req.body.site)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_SITE',
            message: 'Invalid site value',
            details: { validOptions: VALID_SITE_OPTIONS },
            retryable: false,
          },
        });
      }
    }
    
    // Validate valuation amounts if provided
    if (req.body.valuationAmount1 !== undefined && req.body.valuationAmount1 !== null) {
      const amount1 = Number(req.body.valuationAmount1);
      if (isNaN(amount1) || amount1 <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_VALUATION_AMOUNT',
            message: 'Valuation amount 1 must be a positive number',
            retryable: false,
          },
        });
      }
    }
    
    if (req.body.valuationAmount2 !== undefined && req.body.valuationAmount2 !== null) {
      const amount2 = Number(req.body.valuationAmount2);
      if (isNaN(amount2) || amount2 <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_VALUATION_AMOUNT',
            message: 'Valuation amount 2 must be a positive number',
            retryable: false,
          },
        });
      }
    }
    
    if (req.body.valuationAmount3 !== undefined && req.body.valuationAmount3 !== null) {
      const amount3 = Number(req.body.valuationAmount3);
      if (isNaN(amount3) || amount3 <= 0) {
        return res.status(400).json({
          error: {
            code: 'INVALID_VALUATION_AMOUNT',
            message: 'Valuation amount 3 must be a positive number',
            retryable: false,
          },
        });
      }
    }
    
    // Validate visitAssignee if provided (営担検証)
    // employeesテーブルから取得（Google Sheets APIクオータ制限を回避）
    // 訪問日が削除される場合（visitDate === null）は営担バリデーションをスキップ
    if (req.body.visitAssignee !== undefined && req.body.visitAssignee !== null && req.body.visitAssignee !== '' && req.body.visitDate !== null) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!
        );
        
        // employeesテーブルから営担を検索（イニシャルまたは名前で検索）
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('initials, name, is_active')
          .or(`initials.eq.${req.body.visitAssignee},name.eq.${req.body.visitAssignee}`)
          .single();
        
        if (employeeError || !employee) {
          console.error('営担検証エラー（従業員が見つからない）:', employeeError);
          return res.status(400).json({
            error: {
              code: 'INVALID_VISIT_ASSIGNEE',
              message: '無効な営担です',
              retryable: false,
            },
          });
        }
        
        // 有効フラグを確認
        if (!employee.is_active) {
          console.error('営担検証エラー（従業員が無効）:', employee);
          return res.status(400).json({
            error: {
              code: 'INVALID_VISIT_ASSIGNEE',
              message: '無効な営担です',
              retryable: false,
            },
          });
        }
        
        console.log('✅ 営担検証成功:', employee.initials, employee.name);
      } catch (error) {
        console.error('営担検証エラー:', error);
        return res.status(400).json({
          error: {
            code: 'INVALID_VISIT_ASSIGNEE',
            message: '無効な営担です',
            retryable: false,
          },
        });
      }
    }
    
    // Optional: Check valuation amount order (warning only, not blocking)
    if (req.body.valuationAmount1 && req.body.valuationAmount2) {
      const amount1 = Number(req.body.valuationAmount1);
      const amount2 = Number(req.body.valuationAmount2);
      if (amount2 < amount1) {
        console.warn('⚠️ Valuation amount 2 is less than amount 1');
      }
    }
    
    if (req.body.valuationAmount2 && req.body.valuationAmount3) {
      const amount2 = Number(req.body.valuationAmount2);
      const amount3 = Number(req.body.valuationAmount3);
      if (amount3 < amount2) {
        console.warn('⚠️ Valuation amount 3 is less than amount 2');
      }
    }
    
    // 予約情報が更新される場合、カレンダーイベントを作成/更新
    const { appointmentDate, assignedTo, appointmentNotes } = req.body;
    
    if (appointmentDate && assignedTo) {
      console.log('📅 Appointment data detected, will create/update calendar event');
      // SellerServiceに予約情報も渡す
      const seller = await sellerService.updateSellerWithAppointment(
        req.params.id,
        req.body,
        req.employee!.id
      );
      res.json(seller);
      // スプレッドシートに非同期で同期（レスポンスをブロックしない）
      createSpreadsheetSyncService().then(syncService => {
        if (syncService) {
          syncService.syncToSpreadsheet(req.params.id).catch(e =>
            console.error('⚠️ [SpreadsheetSync] Sync error (appointment):', e)
          );
        }
      });
      // サイドバーカウントを非同期で即時更新（レスポンスをブロックしない）
      import('../services/SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseForCounts = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
        const updateService = new SellerSidebarCountsUpdateService(supabaseForCounts);
        updateService.updateSellerSidebarCounts().catch((e: any) =>
          console.error('⚠️ [SidebarCounts] Update error:', e)
        );
      }).catch((e: any) => console.error('⚠️ [SidebarCounts] Import error:', e));
    } else {
      // 通常の更新
      const seller = await sellerService.updateSeller(req.params.id, req.body);
      invalidateDuplicatesCache(req.params.id);

      // スプレッドシートに同期（awaitして確実に完了させる）
      // Vercelサーバーレス環境ではレスポンス後に非同期処理が打ち切られるため、awaitが必須
      try {
        console.log(`🔄 [SpreadsheetSync] Starting sync for seller ${req.params.id}...`);
        const syncService = await createSpreadsheetSyncService();
        if (syncService) {
          console.log(`🔄 [SpreadsheetSync] Service initialized, calling syncToSpreadsheet...`);
          const syncResult = await syncService.syncToSpreadsheet(req.params.id);
          if (syncResult.success) {
            console.log(`✅ [SpreadsheetSync] Sync completed for ${req.params.id}`);
          } else {
            console.error(`⚠️ [SpreadsheetSync] Sync failed for ${req.params.id}:`, syncResult.error);
          }
        } else {
          console.error(`❌ [SpreadsheetSync] createSpreadsheetSyncService returned null for ${req.params.id}`);
        }
      } catch (e) {
        console.error('⚠️ [SpreadsheetSync] Sync error:', e);
      }

      res.json(seller);
      // サイドバーカウントを非同期で即時更新（レスポンスをブロックしない）
      import('../services/SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseForCounts = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
        const updateService = new SellerSidebarCountsUpdateService(supabaseForCounts);
        updateService.updateSellerSidebarCounts().catch((e: any) =>
          console.error('⚠️ [SidebarCounts] Update error:', e)
        );
      }).catch((e: any) => console.error('⚠️ [SidebarCounts] Import error:', e));
    }
  } catch (error: any) {
    console.error('Update seller error:', error);
    res.status(500).json({
      error: {
        code: 'UPDATE_SELLER_ERROR',
        message: error?.message || 'Failed to update seller',
        detail: error?.message,
        retryable: true,
      },
    });
  }
});

/**
 * 売主を削除（ソフトデリート）
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { error } = await supabase
      .from('sellers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      return res.status(500).json({ error: 'Failed to delete seller' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({ error: 'Failed to delete seller' });
  }
});

/**
 * Phase 1: Mark seller as unreachable
 */
router.post('/:id/mark-unreachable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seller = await sellerService.markAsUnreachable(id);
    res.json(seller);
  } catch (error) {
    console.error('Mark unreachable error:', error);
    res.status(500).json({
      error: {
        code: 'MARK_UNREACHABLE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to mark seller as unreachable',
        retryable: true,
      },
    });
  }
});

/**
 * Phase 1: Clear unreachable status
 */
router.post('/:id/clear-unreachable', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seller = await sellerService.clearUnreachable(id);
    res.json(seller);
  } catch (error) {
    console.error('Clear unreachable error:', error);
    res.status(500).json({
      error: {
        code: 'CLEAR_UNREACHABLE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to clear unreachable status',
        retryable: true,
      },
    });
  }
});

/**
 * Phase 1: Confirm duplicate seller
 */
router.post('/:id/confirm-duplicate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seller = await sellerService.confirmDuplicate(id, req.employee!.id);
    res.json(seller);
  } catch (error) {
    console.error('Confirm duplicate error:', error);
    res.status(500).json({
      error: {
        code: 'CONFIRM_DUPLICATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to confirm duplicate',
        retryable: true,
      },
    });
  }
});

/**
 * Phase 1: Get duplicate history for a seller
 */
router.get('/:id/duplicate-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await sellerService.getDuplicateHistory(id);
    res.json(history);
  } catch (error) {
    console.error('Get duplicate history error:', error);
    res.status(500).json({
      error: {
        code: 'GET_DUPLICATE_HISTORY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get duplicate history',
        retryable: true,
      },
    });
  }
});

/**
 * Phase 1: Check for duplicate sellers
 */
router.get('/check-duplicate', [
  query('phone').notEmpty().withMessage('Phone number is required'),
  query('email').optional().isEmail().withMessage('Invalid email format'),
  query('excludeId').optional().isUUID().withMessage('Exclude ID must be a valid UUID'),
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array(),
          retryable: false,
        },
      });
    }

    const { phone, email, excludeId } = req.query;
    const matches = await sellerService.checkDuplicates(
      phone as string,
      email as string | undefined,
      excludeId as string | undefined
    );
    
    res.json({
      hasDuplicates: matches.length > 0,
      matches,
      canProceed: true,
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    res.status(500).json({
      error: {
        code: 'CHECK_DUPLICATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to check for duplicates',
        retryable: true,
      },
    });
  }
});

/**
 * 査定額メールを送信
 */
router.post('/:id/send-valuation-email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // キャッシュをクリアして最新の売主情報を取得
    const { CacheHelper } = await import('../utils/cache');
    const cacheKey = CacheHelper.generateKey('seller', id);
    await CacheHelper.del(cacheKey);

    // 売主情報を取得
    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }

    // メールアドレスが設定されているか確認
    if (!seller.email) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Seller email is not set',
          retryable: false,
        },
      });
    }

    // 査定額1、2、3が設定されているか確認
    console.log('📊 Checking valuation amounts:', {
      valuationAmount1: seller.valuationAmount1,
      valuationAmount2: seller.valuationAmount2,
      valuationAmount3: seller.valuationAmount3,
    });
    
    if (!seller.valuationAmount1 || !seller.valuationAmount2 || !seller.valuationAmount3) {
      console.log('❌ Valuation amounts not set');
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valuation amounts are not calculated yet',
          retryable: false,
        },
      });
    }

    // 固定資産税路線価を取得
    const fixedAssetTaxRoadPrice = (seller.property as any)?.fixedAssetTaxRoadPrice || 
                                   (seller.property as any)?.sellerFixedAssetTaxRoadPrice;

    // 査定データを準備
    const valuationData = {
      valuationAmount1: seller.valuationAmount1,
      valuationAmount2: seller.valuationAmount2,
      valuationAmount3: seller.valuationAmount3,
      fixedAssetTaxRoadPrice,
      landArea: seller.property?.landArea,
      buildingArea: seller.property?.buildingArea,
    };

    // メール送信
    const { EmailService } = await import('../services/EmailService.supabase');
    const emailService = new EmailService();
    const result = await emailService.sendValuationEmail(
      seller,
      valuationData as any,
      req.employee!.email,
      req.employee!.id
    );

    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'EMAIL_SEND_ERROR',
          message: result.error || 'Failed to send valuation email',
          retryable: true,
        },
      });
    }

    res.json({
      success: true,
      messageId: result.messageId,
      sentAt: result.sentAt,
    });
  } catch (error) {
    console.error('Send valuation email error:', error);
    res.status(500).json({
      error: {
        code: 'EMAIL_SEND_ERROR',
        message: error instanceof Error ? error.message : 'Failed to send valuation email',
        retryable: true,
      },
    });
  }
});

/**
 * 売主の追客ログ履歴を取得
 */
router.get(
  '/:sellerNumber/follow-up-logs/history',
  [
    query('refresh').optional().isBoolean().withMessage('Refresh must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: errors.array(),
            retryable: false,
          },
        });
      }

      const { sellerNumber } = req.params;
      const forceRefresh = req.query.refresh === 'true';

      // FollowUpLogHistoryServiceを動的にインポート
      const { followUpLogHistoryService } = await import('../services/FollowUpLogHistoryService');

      // 履歴ログを取得
      const logs = await followUpLogHistoryService.getHistoricalLogs(sellerNumber, forceRefresh);

      // 最終更新時刻を取得
      const lastUpdated = await followUpLogHistoryService.getLastUpdateTime();

      res.json({
        success: true,
        data: logs,
        cached: !forceRefresh,
        lastUpdated: lastUpdated?.toISOString() || null,
      });
    } catch (error) {
      console.error('Get follow-up log history error:', error);
      res.status(500).json({
        success: false,
        error: 'FOLLOW_UP_LOG_HISTORY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get follow-up log history',
      });
    }
  }
);

/**
 * 売主の近隣買主リストを取得
 * GET /api/sellers/:id/nearby-buyers
 */
router.get('/:id/nearby-buyers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { overridePropertyType } = req.query;
    console.log(`🔍 Getting nearby buyers for seller ${id}${overridePropertyType ? ` (overridePropertyType: ${overridePropertyType})` : ''}`);

    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Seller not found', retryable: false },
      });
    }

    if (!seller.propertyAddress) {
      return res.json({
        buyers: [],
        matchedAreas: [],
        propertyAddress: null,
        propertyType: null,
        salesPrice: null,
        propertyDetails: null,
        message: '物件住所が設定されていません',
      });
    }

    // シングルトンインスタンスを使用（キャッシュが維持される）
    const calculator = distributionCalculator;
    const cityExtractor_local = cityExtractor;

    const googleMapUrl = (seller as any).googleMapUrl || null;
    // overridePropertyType が指定された場合はそちらを使用（例: 戸建物件で土地希望買主を検索）
    // sellers.property_type が null の場合は properties テーブルの値をフォールバックとして使用
    const propertyTypeFromProperties = seller.property?.propertyType || null;
    const propertyType = (typeof overridePropertyType === 'string' ? overridePropertyType : null) || seller.propertyType || propertyTypeFromProperties || null;
    console.log(`🏠 propertyType resolved: sellers.property_type=${seller.propertyType}, properties.property_type=${propertyTypeFromProperties}, final=${propertyType}`);

    // 査定額の中央値を売出価格として使用
    let salesPrice: number | null = null;
    const valuations = [
      seller.valuationAmount1,
      seller.valuationAmount2,
      seller.valuationAmount3,
    ].filter(v => v !== null && v !== undefined) as number[];
    if (valuations.length > 0) {
      valuations.sort((a, b) => a - b);
      const mid = Math.floor(valuations.length / 2);
      salesPrice = valuations.length % 2 === 0
        ? (valuations[mid - 1] + valuations[mid]) / 2
        : valuations[mid];
    }

    const city = cityExtractor_local.extractCityFromAddress(seller.propertyAddress);

    // sellersテーブルから保存済み座標を取得（物件位置セクションと同じ方法）
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: sellerRaw } = await supabase
      .from('sellers')
      .select('latitude, longitude')
      .eq('id', id)
      .single();
    const preloadedCoords = (sellerRaw?.latitude && sellerRaw?.longitude)
      ? { lat: sellerRaw.latitude, lng: sellerRaw.longitude }
      : null;

    const result = await calculator.calculateDistributionAreas(googleMapUrl, city, seller.propertyAddress, preloadedCoords);

    if (!result.areas || result.areas.length === 0) {
      // propertyDetailsオブジェクトを構築
      const propertyDetails = seller.property ? {
        address: seller.property.address || null,
        landArea: seller.property.landArea ?? null,
        buildingArea: seller.property.buildingArea ?? null,
        landAreaVerified: seller.property.landAreaVerified ?? null,
        buildingAreaVerified: seller.property.buildingAreaVerified ?? null,
        buildYear: seller.property.buildYear ?? null,
        floorPlan: seller.property.floorPlan || null,
      } : null;

      return res.json({
        buyers: [],
        matchedAreas: [],
        propertyAddress: seller.propertyAddress,
        propertyType,
        salesPrice,
        propertyDetails,
        message: '配布エリアを特定できませんでした',
      });
    }

    const buyerService = new BuyerService();
    const buyers = await buyerService.getBuyersByAreas(result.areas, propertyType, salesPrice);

    console.log(`✅ Found ${buyers.length} nearby buyers for seller ${id}`);

    // propertyDetailsオブジェクトを構築
    const propertyDetails = seller.property ? {
      address: seller.property.address || null,
      landArea: seller.property.landArea ?? null,
      buildingArea: seller.property.buildingArea ?? null,
      landAreaVerified: seller.property.landAreaVerified ?? null,
      buildingAreaVerified: seller.property.buildingAreaVerified ?? null,
      buildYear: seller.property.buildYear ?? null,
      floorPlan: seller.property.floorPlan || null,
    } : null;

    res.json({
      buyers,
      matchedAreas: result.areas,
      propertyAddress: seller.propertyAddress,
      propertyType,
      salesPrice,
      propertyDetails,
    });
  } catch (error) {
    console.error('Get nearby buyers error:', error);
    res.status(500).json({
      error: {
        code: 'GET_NEARBY_BUYERS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get nearby buyers',
        retryable: true,
      },
    });
  }
});

/**
 * GET /api/sellers/:id/inquiry-url
 * 査定書作成シートから反響URLを取得
 * 取得範囲: B:E
 *   B列(index 0) = 日付（反響日付と照合）
 *   C列(index 1) = 反響URL（取得対象）
 *   E列(index 3) = 物件住所（照合）
 * 照合条件:
 *   B列(日付)の日付部分 = DBの inquiry_date（反響日付）
 *   かつ E列(物件住所) = DBの property_address
 */
router.get('/:id/inquiry-url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 反響日付（inquiry_date）と物件住所で照合
    const inquiryDate = (seller as any).inquiryDate;
    const propertyAddress = seller.propertyAddress;

    if (!inquiryDate && !propertyAddress) {
      return res.json({ inquiryUrl: 'https://tsunagaru-online.jp/partner/@5jJ7Ue/satei?assessmentStatuses=waiting_assessment' });
    }

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');

    const SPREADSHEET_ID = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
    const SHEET_NAME = '査定書作成';

    const client = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: SHEET_NAME,
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await client.authenticate();

    // B列(日付), C列(反響URL), D列, E列(物件住所) を取得
    const sheetsInstance = (client as any).sheets;
    const response = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B:E`,
    });

    const rows: string[][] = response.data.values || [];

    // 正規化: 空白除去
    const normalize = (s: string) => (s || '').trim();

    // 日付文字列を YYYY/M/D 形式に正規化（時刻は無視）
    const toDateStr = (dt: string | Date) => {
      if (!dt) return '';
      const d = new Date(dt as any);
      if (isNaN(d.getTime())) {
        return normalize(String(dt)).split(' ')[0];
      }
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };

    const sellerDateStr = toDateStr(inquiryDate);
    const sellerAddress = normalize(propertyAddress || '');

    console.log(`[inquiry-url] seller inquiry_date: ${inquiryDate} → ${sellerDateStr}`);
    console.log(`[inquiry-url] seller property_address: ${sellerAddress}`);

    let inquiryUrl: string | null = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowDate = normalize(row[0] || '');    // B列(index 0) = 日付
      const rowUrl = normalize(row[1] || '');     // C列(index 1) = 反響URL
      const rowAddress = normalize(row[3] || ''); // E列(index 3) = 物件住所

      if (!rowUrl) continue;

      const rowDateStr = toDateStr(rowDate);

      const dateMatch = sellerDateStr && rowDateStr && sellerDateStr === rowDateStr;
      // 住所は部分一致で照合（スプレッドシートに「大分県」が含まれるがDBにはない場合に対応）
      const addressMatch = sellerAddress && rowAddress && (
        sellerAddress === rowAddress ||
        rowAddress.includes(sellerAddress) ||
        sellerAddress.includes(rowAddress)
      );

      if (dateMatch && addressMatch) {
        inquiryUrl = rowUrl;
        console.log(`[inquiry-url] 一致: row ${i + 1}, url: ${rowUrl}`);
        break;
      }
    }

    if (!inquiryUrl) {
      console.log(`[inquiry-url] 一致なし: date=${sellerDateStr}, address=${sellerAddress}`);
      // スプレッドシートに一致する行がない場合はフォールバックURLを使用
      inquiryUrl = 'https://tsunagaru-online.jp/partner/@5jJ7Ue/satei?assessmentStatuses=waiting_assessment';
    }

    res.json({ inquiryUrl });
  } catch (error) {
    console.error('Get inquiry URL error:', error);
    res.status(500).json({ error: 'Failed to get inquiry URL' });
  }
});

/**
 * エリア情勢レポートを生成（AI使用・JSON方式）
 * POST /api/sellers/:id/area-report
 */
router.post('/:id/area-report', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seller = await sellerService.getSeller(id);
    if (!seller) return res.status(404).json({ error: 'Seller not found' });

    const address = seller.propertyAddress || seller.address || '';
    if (!address) return res.status(400).json({ error: '物件住所が設定されていません' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEYが設定されていません' });

    const propertyType = seller.propertyType || '';

    // 住所から市区町村・町名を抽出
    // 都道府県あり: 「大分県別府市浜町21-9」→ city=別府市
    // 都道府県なし: 「別府市浜町21-9」→ city=別府市
    // [市区]の前に必ず1文字以上の非[市区]文字が必要（「市浜町」誤マッチ防止）
    const prefMatch = address.match(/^(東京都|北海道|大阪府|京都府|[\u3040-\u9FFF]{2,3}県)/);
    let city = '';
    if (prefMatch) {
      const afterPref = address.slice(prefMatch[1].length);
      const cityMatch = afterPref.match(/^([\u3040-\u9FFF]+?[市区])/);
      city = cityMatch ? cityMatch[1] : afterPref.substring(0, 4);
    } else {
      const cityMatch = address.match(/^([\u3040-\u9FFF]+?[市区])/);
      city = cityMatch ? cityMatch[1] : address.substring(0, 4);
    }
    const cityEnd = address.indexOf(city) + city.length;
    const afterCity = address.slice(cityEnd);
    // 全角数字・半角数字・ハイフン・スペースの前までを町名として抽出
    // 「大字葛木９９６」→「大字葛木」、「金池町1丁目」→「金池町」、「南太平寺1丁目」→「南太平寺」
    const townMatch = afterCity.match(/^([^\d\s\-0-9０-９]{2,12}?)(?=[\d０-９\s\-]|$)/);
    const townRaw = townMatch ? townMatch[1].trim() : '';
    // 「南太平寺1丁目」→「南太平寺」（丁目番号のみ除去、末尾の「町」「字」は残す）
    const town = townRaw.replace(/\d+丁目$/, '').trim();
    const detailArea = town || city;
    const cityLabel = city;

    console.log('[area-report] address:', address, '| city:', city, '| town:', town);

    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    // e-Stat APIから実際の人口データを取得
    const areaRatio = estimateAreaRatio(city, town);
    const [realPopData, realTrxData, realPriceData] = await Promise.all([
      fetchPopulationData(city, areaRatio),
      fetchTransactionData(city, areaRatio),
      fetchPriceData(city),
    ]);

    // 人口データをプロンプトに埋め込む（実データがある場合）
    const populationHint = realPopData
      ? `\n【実際の国勢調査データ（必ずこの数値を使用すること）】\n人口（${cityLabel}全体）:\n${realPopData.map(r => `  ${r.year}: ${r.city.toLocaleString()}人`).join('\n')}\n人口（${detailArea}エリア推計）:\n${realPopData.map(r => `  ${r.year}: ${r.area.toLocaleString()}人`).join('\n')}\n※上記の人口数値は国勢調査の実データです。populationフィールドには必ずこの数値を使用してください。`
      : '';

    // 取引件数データをプロンプトに埋め込む
    const transactionHint = realTrxData
      ? `\n【実際の取引件数データ（必ずこの数値を使用すること）】\n取引件数（${cityLabel}全体）:\n${realTrxData.map(r => `  ${r.year}: ${r.city}件`).join('\n')}\n取引件数（${detailArea}エリア推計）:\n${realTrxData.map(r => `  ${r.year}: ${r.area}件`).join('\n')}\n※上記の取引件数は国土交通省の実データです。transactionsフィールドには必ずこの数値を使用してください。`
      : '';

    // 価格データをプロンプトに埋め込む
    const priceHint = realPriceData
      ? `\n【実際の坪単価データ（必ずこの数値を使用すること）】\n坪単価（${cityLabel}全体・万円）:\n${realPriceData.map(r => `  ${r.year}: ${r.city}万円`).join('\n')}\n坪単価（${detailArea}エリア推計・万円）:\n${realPriceData.map(r => `  ${r.year}: ${r.area}万円`).join('\n')}\n※上記の坪単価は国土交通省の実データです。pricesフィールドには必ずこの数値を使用してください。`
      : '';

    const jsonPrompt = `${cityLabel}の${detailArea}エリアについて、実際の統計・市場データに基づいた不動産売却資料用のJSONを返してください。現在2026年。
${populationHint}${transactionHint}${priceHint}
【重要な数値生成ルール】
- 人口：${realPopData ? '上記の実データを必ず使用すること（改変禁止）' : '国勢調査・住民基本台帳の実態に近い数値を使用。毎年一定ではなく、年によって増減幅が異なる'}
- 取引件数：${realTrxData ? '上記の実データを必ず使用すること（改変禁止）' : '景気・金利・コロナ禍（2020-2021年）の影響を反映。コロナ禍は件数が落ち込み、2022年以降に回復するなど現実的な波を持たせる'}
- 不動産価格：${realPriceData ? '上記の実データを必ず使用すること（改変禁止）' : '坪単価を万円単位の整数で返すこと。2020年以降の全国的な地価上昇トレンドを反映しつつ、エリアの特性に応じた現実的な数値'}
- 世帯構成：そのエリアの実態（高齢化率・単身世帯増加傾向など）を反映した%
- 年齢構成の推移：国勢調査の実態に近い数値を使用。年少人口（0-14歳）・生産年齢人口（15-64歳）・老年人口（65歳以上）の割合（%）を返すこと。高齢化の進行を反映した現実的な数値にすること
- 絶対に等差数列（毎年同じ増減幅）にしないこと。実際のデータは不規則にばらつく

各コメントはデータの傾向を客観的に説明する内容にしてください（40〜60字程度）。
「売却をお考えください」「今が売り時」「売却のチャンス」などの売却を促す表現は一切使わないこと。
「〜の傾向が見られます」「〜となっています」のように事実を述べる表現で終わること。
summaryの各項目は売却意欲を高める内容にしてください。「〇〇のため、早めの売却が望ましい」「〇〇により、売却時期として適している」のように、データを根拠にした売却推奨の表現を使うこと。

{"population":[{"year":"2015年","city":数値,"area":数値},{"year":"2018年","city":数値,"area":数値},{"year":"2021年","city":数値,"area":数値},{"year":"2024年","city":数値,"area":数値},{"year":"2025年","city":数値,"area":数値}],"populationComment":"人口動向の客観的説明","ageDistribution":[{"year":"2015年","young":"XX%","working":"XX%","elderly":"XX%"},{"year":"2018年","young":"XX%","working":"XX%","elderly":"XX%"},{"year":"2021年","young":"XX%","working":"XX%","elderly":"XX%"},{"year":"2024年","young":"XX%","working":"XX%","elderly":"XX%"},{"year":"2025年","young":"XX%","working":"XX%","elderly":"XX%"}],"ageDistributionComment":"年齢構成推移の客観的説明","household":[{"type":"単身世帯","city":"XX%","area":"XX%"},{"type":"夫婦のみ","city":"XX%","area":"XX%"},{"type":"核家族","city":"XX%","area":"XX%"},{"type":"三世代同居","city":"XX%","area":"XX%"}],"householdComment":"世帯構成の客観的説明","transactions":[{"year":"2020年","city":数値,"area":数値},{"year":"2021年","city":数値,"area":数値},{"year":"2022年","city":数値,"area":数値},{"year":"2023年","city":数値,"area":数値},{"year":"2024年","city":数値,"area":数値},{"year":"2025年","city":数値,"area":数値}],"transactionsComment":"取引件数の客観的説明","prices":[{"year":"2020年","city":数値,"area":数値},{"year":"2021年","city":数値,"area":数値},{"year":"2022年","city":数値,"area":数値},{"year":"2023年","city":数値,"area":数値},{"year":"2024年","city":数値,"area":数値},{"year":"2025年","city":数値,"area":数値}],"pricesComment":"価格推移の客観的説明","summary":["市場の特徴1（客観的事実）","市場の特徴2（客観的事実）","市場の特徴3（客観的事実）","市場の特徴4（客観的事実）","市場の特徴5（客観的事実）"]}

JSONのみ返してください。`;

    const axios = (await import('axios')).default;
    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `あなたは日本の不動産市場に精通したデータアナリストです。国勢調査・住民基本台帳・国土交通省地価公示・不動産取引価格情報などの実際の統計データの知識を活かし、${cityLabel}の実態に即したリアルな数値を生成してください。左列ラベルは必ず「${cityLabel}全体」、右列ラベルは必ず「${detailArea}エリア」を使用します。数値は毎年同じ増減幅（等差数列）にならないよう、現実のデータのような不規則なばらつきを持たせてください。コメントは客観的な事実の説明のみとし、売却を促す表現は一切使わないこと。年齢構成の推移（ageDistribution）は年少人口（0-14歳）・生産年齢人口（15-64歳）・老年人口（65歳以上）の割合（%）を返すこと。` },
          { role: 'user', content: jsonPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1600,
      },
      { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 55000 }
    );

    const raw = completion.data.choices[0]?.message?.content || '{}';
    const rawClean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let data: any;
    try { data = JSON.parse(rawClean); } catch { data = {}; }

    const CL = cityLabel + '全体';
    const AL = detailArea + 'エリア';
    const th = 'border:1px solid #90caf9;padding:6px 10px;text-align:center;';
    const td = 'border:1px solid #ccc;padding:5px 10px;text-align:center;';
    const tda = 'border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;';

    const arw = (cur: number, prev: number | null) => {
      if (prev === null) return '';
      if (cur > prev) return ' <span style="color:#c62828;font-weight:bold;">↑</span>';
      if (cur < prev) return ' <span style="color:#e53935;">▼</span>';
      return '';
    };

    const pop = data.population || [];
    const popRows = pop.map((r: any, i: number) => {
      const b = i === pop.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${td}${b}">${r.year}</td><td style="${td}${b}">${Number(r.city).toLocaleString()}人${arw(r.city, i > 0 ? pop[i-1].city : null)}</td><td style="${tda}${b}">${Number(r.area).toLocaleString()}人${arw(r.area, i > 0 ? pop[i-1].area : null)}</td></tr>`;
    }).join('');

    // 年齢構成の推移テーブル（②）
    const age = data.ageDistribution || [];
    const ageTh = 'border:1px solid #90caf9;padding:6px 10px;text-align:center;';
    const ageTd = 'border:1px solid #ccc;padding:5px 10px;text-align:center;';
    const ageRows = age.map((r: any, i: number) => {
      const b = i === age.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${ageTd}${b}">${r.year}</td><td style="${ageTd}${b}">${r.young}</td><td style="${ageTd}${b}">${r.working}</td><td style="${ageTd}${b}">${r.elderly}</td></tr>`;
    }).join('');
    const ageTbl = age.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr style="background:#e3f2fd;"><th style="${ageTh}width:20%">年</th><th style="${ageTh}width:26%">年少人口<br><span style="font-size:10px;font-weight:normal;">（0〜14歳）</span></th><th style="${ageTh}width:27%">生産年齢人口<br><span style="font-size:10px;font-weight:normal;">（15〜64歳）</span></th><th style="${ageTh}width:27%;background:#fff9c4">老年人口<br><span style="font-size:10px;font-weight:normal;">（65歳以上）</span></th></tr></thead><tbody>${ageRows}</tbody></table>`
      : '<p style="color:#999;font-size:11px;">データなし</p>';

    const hh = data.household || [];
    const hhRows = hh.map((r: any) => `<tr><td style="${td}">${r.type}</td><td style="${td}">${r.city}</td><td style="${tda}">${r.area}</td></tr>`).join('');

    const trx = data.transactions || [];
    const trRows = trx.map((r: any, i: number) => {
      const b = i === trx.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${td}${b}">${r.year}</td><td style="${td}${b}">${Number(r.city).toLocaleString()}件${arw(r.city, i > 0 ? trx[i-1].city : null)}</td><td style="${tda}${b}">${Number(r.area).toLocaleString()}件${arw(r.area, i > 0 ? trx[i-1].area : null)}</td></tr>`;
    }).join('');

    const pr = data.prices || [];
    const prRows = pr.map((r: any, i: number) => {
      const b = i === pr.length - 1 ? 'font-weight:bold;' : '';
      // AIが円単位で返してきた場合（10000以上）は万円に変換する
      const toMan = (v: number) => v >= 10000 ? Math.round(v / 10000) : v;
      const cityVal = toMan(Number(r.city));
      const areaVal = toMan(Number(r.area));
      const prevCityVal = i > 0 ? toMan(Number(pr[i-1].city)) : null;
      const prevAreaVal = i > 0 ? toMan(Number(pr[i-1].area)) : null;
      return `<tr><td style="${td}${b}">${r.year}</td><td style="${td}${b}">${cityVal.toLocaleString()}万円${arw(cityVal, prevCityVal)}</td><td style="${tda}${b}">${areaVal.toLocaleString()}万円${arw(areaVal, prevAreaVal)}</td></tr>`;
    }).join('');

    const summary = (data.summary || []).map((s: string) => `<li style="margin-bottom:8px;"><strong style="color:#c62828;">${s}</strong></li>`).join('');

    const tbl = (rows: string) => `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr style="background:#e3f2fd;"><th style="${th}width:20%">年</th><th style="${th}width:40%">${CL}</th><th style="${th}width:40%;background:#fff9c4">${AL}</th></tr></thead><tbody>${rows}</tbody></table>`;
    const hhTbl = `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr style="background:#e3f2fd;"><th style="${th}width:20%">世帯種類</th><th style="${th}width:40%">${CL}</th><th style="${th}width:40%;background:#fff9c4">${AL}</th></tr></thead><tbody>${hhRows}</tbody></table>`;
    const cmt = (t: string) => `<p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${t}</p>`;
    const sec = (n: string, t: string) => `<h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">${n} ${t}</h2>`;

    const htmlContent = `<style>@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}@page{size:A4;margin:15mm;}}</style>
<div style="font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px;">
<div style="text-align:center;border-bottom:3px solid #1a237e;padding-bottom:12px;margin-bottom:20px;">
<div style="font-size:10px;color:#666;margin-bottom:4px;">不動産売却のご参考資料</div>
<h1 style="font-size:20px;color:#1a237e;margin:0 0 4px;">エリア情勢レポート</h1>
<div style="font-size:14px;font-weight:bold;">${AL}</div>
<div style="font-size:10px;color:#888;margin-top:4px;">作成日：${today}　物件種別：${propertyType || '不動産'}</div>
</div>
<div style="margin-bottom:24px;">${sec('①', '人口の推移')}${tbl(popRows)}${cmt(data.populationComment || '')}</div>
<div style="margin-bottom:24px;">${sec('②', '年齢構成の推移')}${ageTbl}${cmt(data.ageDistributionComment || '')}</div>
<div style="margin-bottom:24px;">${sec('③', '世帯種類の推移')}${hhTbl}${cmt(data.householdComment || '')}</div>
<div style="margin-bottom:24px;">${sec('④', '物件種別の取引件数推移')}${tbl(trRows)}${cmt(data.transactionsComment || '')}</div>
<div style="margin-bottom:24px;">${sec('⑤', '不動産価格の推移（坪単価・万円）')}${tbl(prRows)}${cmt(data.pricesComment || '')}</div>
<div style="margin-bottom:24px;background:#fffde7;border:2px solid #f9a825;border-radius:8px;padding:16px;">
<h2 style="font-size:15px;color:#e65100;border-left:4px solid #e65100;padding-left:8px;margin-bottom:12px;">⑥ まとめ ── ${AL}で今が売却のチャンスである理由</h2>
<ul style="margin:0;padding-left:20px;line-height:2;">${summary}</ul>
<div style="margin-top:12px;text-align:center;background:#e65100;color:white;padding:8px;border-radius:4px;font-size:13px;font-weight:bold;">✅ ${AL}のデータが示す通り、今が最も有利な売却タイミングです</div>
</div>
<div style="border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center;">※本レポートの数値は市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。</div>
</div>`;

    res.json({ html: htmlContent, areaName: detailArea, cityLabel, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Area report generation error:', error?.message || error);
    res.status(500).json({ error: error?.response?.data?.error?.message || error?.message || 'エリア情勢レポートの生成に失敗しました' });
  }
});

// ============================================================
// ポータルサイト掲載メリット生成エンドポイント（OpenAI APIで住所から箇条書きを生成）
// ============================================================

/**
 * POST /api/sellers/:id/portal-merits
 * 物件の座標からGoogle Maps Places APIで周辺施設を取得し、
 * Distance Matrix APIで正確な距離・所要時間を算出してからChatGPTに渡す
 */
router.post('/:id/portal-merits', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) return res.status(404).json({ error: 'Seller not found' });

    const address = (seller as any).propertyAddress || (seller as any).property_address || '';
    if (!address) return res.status(400).json({ error: '物件住所が設定されていません' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEYが設定されていません' });

    // 物件情報を収集
    const propertyType = (seller as any).propertyType || (seller as any).property_type || '';
    const buildYear    = (seller as any).buildYear    || (seller as any).build_year    || '';
    const floorPlan    = (seller as any).floorPlan    || (seller as any).floor_plan    || '';
    const structure    = (seller as any).structure    || '';
    const landArea     = (seller as any).landArea     || (seller as any).land_area     || '';
    const buildingArea = (seller as any).buildingArea || (seller as any).building_area || '';

    // ── 座標取得（DBに保存済み優先、なければジオコーディング） ──
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: sellerRaw } = await supabase
      .from('sellers')
      .select('latitude, longitude')
      .eq('id', id)
      .single();

    let lat: number | null = sellerRaw?.latitude || null;
    let lng: number | null = sellerRaw?.longitude || null;

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if ((!lat || !lng) && googleApiKey) {
      try {
        const { GeocodingService } = await import('../services/GeocodingService');
        const geocodingService = new GeocodingService();
        const sellerPrefix = ((seller as any).sellerNumber || '').slice(0, 2);
        const coords = await geocodingService.geocodeAddress(address, sellerPrefix);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          await supabase.from('sellers').update({ latitude: lat, longitude: lng }).eq('id', id);
        }
      } catch (e) {
        console.warn('[portal-merits] ジオコーディング失敗:', e);
      }
    }

    // ── Google Maps Places API で周辺施設を取得（座標がある場合のみ） ──
    // カテゴリ: 駅・バス停・スーパー・コンビニ・学校・公園・病院
    let nearbyFacts = '';

    if (lat && lng && googleApiKey) {
      const axios = (await import('axios')).default;
      const origin = `${lat},${lng}`;

      // 取得するカテゴリ（Places APIのtype、radius=2000m）
      const searchTargets = [
        { type: 'train_station',     label: '駅',           keyword: '' },
        { type: 'bus_station',       label: 'バス停',       keyword: '' },
        { type: 'supermarket',       label: 'スーパー',     keyword: '' },
        { type: 'convenience_store', label: 'コンビニ',     keyword: '' },
        { type: 'school',            label: '小学校',       keyword: '小学校' },
        { type: 'school',            label: '中学校',       keyword: '中学校' },
        { type: 'park',              label: '公園',         keyword: '' },
        { type: 'hospital',          label: '病院',         keyword: '' },
      ];

      // 各カテゴリの近傍施設を並列取得（駅のみ上位3件、それ以外は最近傍1件）
      type PlaceHit = { label: string; name: string; distanceM: number };
      const placesResults: PlaceHit[] = [];

      await Promise.all(
        searchTargets.map(async (target) => {
          try {
            const params: Record<string, string | number> = {
              location: origin,
              radius: 2000,
              type: target.type,
              language: 'ja',
              key: googleApiKey,
            };
            if (target.keyword) params.keyword = target.keyword;

            const resp = await axios.get(
              'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
              { params, timeout: 8000 }
            );

            if (resp.data.status === 'OK' && resp.data.results?.length > 0) {
              // keyword がある場合は名前フィルタ
              let candidates = resp.data.results as any[];
              if (target.keyword) {
                candidates = candidates.filter((p: any) =>
                  (p.name || '').includes(target.keyword)
                );
              }
              if (candidates.length === 0) return;

              // 直線距離で近い順にソート
              const sorted = candidates
                .map((p: any) => ({
                  name: p.name as string,
                  pLat: p.geometry?.location?.lat as number,
                  pLng: p.geometry?.location?.lng as number,
                }))
                .filter((p) => p.pLat && p.pLng)
                .map((p) => {
                  const dLat = ((p.pLat - lat!) * Math.PI) / 180;
                  const dLng = ((p.pLng - lng!) * Math.PI) / 180;
                  const a = Math.sin(dLat / 2) ** 2
                    + Math.cos((lat! * Math.PI) / 180)
                    * Math.cos((p.pLat * Math.PI) / 180)
                    * Math.sin(dLng / 2) ** 2;
                  const distM = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
                  return { ...p, distM };
                })
                .sort((a, b) => a.distM - b.distM);

              // 駅のみ上位3件まで取得（複数駅が近い場合を考慮）、それ以外は1件
              if (target.label === '駅') {
                const top3 = sorted.slice(0, 3);
                // 1位を必ず追加
                if (top3.length > 0) {
                  placesResults.push({ label: '駅', name: top3[0].name, distanceM: top3[0].distM });
                }
                // 2位以降は1位との距離差が500m以内の場合のみ追加
                for (let i = 1; i < top3.length; i++) {
                  if (top3[i].distM - top3[0].distM <= 500) {
                    placesResults.push({ label: '駅', name: top3[i].name, distanceM: top3[i].distM });
                  }
                }
              } else {
                if (sorted.length > 0) {
                  placesResults.push({ label: target.label, name: sorted[0].name, distanceM: sorted[0].distM });
                }
              }
            }
          } catch (e) {
            // Places取得失敗は無視（後でChatGPTが補完する）
          }
        })
      );

      // ── Distance Matrix API で実際の所要時間を一括取得 ──
      if (placesResults.length > 0) {
        try {
          // 直線距離から徒歩・車の目安を計算（80m/分=徒歩、400m/分=車）
          const lines: string[] = [];
          for (const p of placesResults) {
            const walkMin = Math.round(p.distanceM / 80);
            const carMin  = Math.round(p.distanceM / 400);
            const distKm  = (p.distanceM / 1000).toFixed(1);
            // 800m以内は徒歩表記、それ以上は車表記を優先
            if (p.distanceM <= 800) {
              lines.push(`${p.label}: ${p.name}（徒歩約${walkMin}分・${distKm}km）`);
            } else if (p.distanceM <= 2000) {
              lines.push(`${p.label}: ${p.name}（徒歩約${walkMin}分 / 車約${carMin}分・${distKm}km）`);
            } else {
              lines.push(`${p.label}: ${p.name}（車約${carMin}分・${distKm}km）`);
            }
          }

          // Distance Matrix API で駅は徒歩の正確な所要時間を取得（全駅対象）
          const stationHits = placesResults.filter(p => p.label === '駅');
          for (const stationHit of stationHits) {
            try {
              const dmResp = await axios.get(
                'https://maps.googleapis.com/maps/api/distancematrix/json',
                {
                  params: {
                    origins: origin,
                    destinations: `${stationHit.name} 駅`,
                    mode: 'walking',
                    language: 'ja',
                    key: googleApiKey,
                  },
                  timeout: 8000,
                }
              );
              const el = dmResp.data?.rows?.[0]?.elements?.[0];
              if (el?.status === 'OK') {
                const durationText: string = el.duration?.text || '';
                const distText: string     = el.distance?.text || '';
                // 対応する駅行を上書き（同名駅の最初のマッチを更新）
                const idx = lines.findIndex(l => l.startsWith(`駅: ${stationHit.name}`));
                if (idx >= 0 && durationText) {
                  lines[idx] = `駅: ${stationHit.name}（徒歩約${durationText}・${distText}）`;
                }
              }
            } catch (e) {
              // Distance Matrix失敗は無視
            }
          }

          nearbyFacts = lines.join('\n');
        } catch (e) {
          console.warn('[portal-merits] Distance Matrix失敗:', e);
        }
      }
    }

    // ── 物件スペック文字列 ──
    const details: string[] = [];
    if (propertyType) details.push(`種別: ${propertyType}`);
    if (buildYear)    details.push(`築年: ${buildYear}年`);
    if (floorPlan)    details.push(`間取り: ${floorPlan}`);
    if (structure)    details.push(`構造: ${structure}`);
    if (landArea)     details.push(`土地面積: ${landArea}㎡`);
    if (buildingArea) details.push(`建物面積: ${buildingArea}㎡`);
    const detailStr = details.length > 0 ? `\n物件情報: ${details.join(' / ')}` : '';

    // 周辺施設を「実測データ」としてプロンプトに埋め込む
    const nearbySection = nearbyFacts
      ? `\n\n【Google Mapsで取得した実際の周辺施設データ（必ずこの数値を使用すること・改変禁止）】\n${nearbyFacts}\n※上記の距離・所要時間は実測値です。立地・アクセスカテゴリでは必ずこの数値をそのまま使用してください。`
      : '';

    const prompt = `以下の不動産物件について、ポータルサイト（SUUMO・アットホーム・LIFULL HOME'S等）に掲載する際の売却につながるアピールポイントを、できるだけ多くの箇条書きで列挙してください。

物件住所: ${address}${detailStr}${nearbySection}

【出力フォーマット（厳守）】
以下の形式で出力してください。カテゴリ見出しは「【カテゴリ名】」の形式で、「・」は付けないこと。
見出し行の直後に箇条書き項目を「・」で始めて列挙してください。

【立地・アクセス】
・（項目1）
・（項目2）
・（項目3）
（以下同様）

【住環境（緑・公園・静けさなど）】
・（項目1）
...

【買物・生活利便】
・（項目1）
...

【子育て環境（学校・保育園など）】
・（項目1）
...

【物件の特徴・スペック（築年・構造・間取り等）】
・（項目1）
...

【売主向けに響く表現・キャッチコピー】
・（項目1）
...

【ルール】
- 各カテゴリに3項目以上を必ず挙げること
- 上記の実測データがある施設は必ずその数値を使い、距離・時間を改変しないこと
- 実測データにない施設は施設名と距離の推定値を添えること
- カテゴリ見出し行には「・」「-」「●」等の記号を付けないこと（「【カテゴリ名】」の形式を厳守）
- 出力はプレーンテキスト（Markdownなし）にすること`;

    const axiosLib = (await import('axios')).default;
    const completion = await axiosLib.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'あなたは日本の不動産売却に精通したプロのコンサルタントです。提供された実測の周辺施設データを優先的に使い、物件の立地・周辺施設・物件スペックなどを踏まえた具体的で説得力のある掲載アピールポイントを生成してください。距離・所要時間は提供されたデータをそのまま使用し、絶対に改変しないでください。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 55000,
      }
    );

    const text: string = completion.data.choices[0]?.message?.content?.trim() || '';
    res.json({ text, address });

  } catch (error: any) {
    console.error('[portal-merits] エラー:', error?.message || error);
    res.status(500).json({ error: error?.response?.data?.error?.message || error?.message || 'メリット生成に失敗しました' });
  }
});


// ============================================================
// 住所読み仮名取得エンドポイント（OpenAI APIで住所のひらがな読みを取得）
// ============================================================

/**
 * GET /api/sellers/:id/address-reading
 * 売主の物件住所をOpenAI APIでひらがな読みに変換して返す
 */
router.get('/:id/address-reading', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) return res.status(404).json({ error: '売主が見つかりません' });

    // 住所の取得（propertiesテーブル優先、なければsellersテーブル）
    const address = (seller as any).property?.address || seller.propertyAddress || '';
    if (!address || address.trim() === '' || address.trim() === '未入力') {
      return res.status(400).json({ error: '物件住所が設定されていません' });
    }

    // 地名辞書（OpenAI APIが間違える地名を直接定義）
    const localReadingDict: { [key: string]: string } = {
      // 大分県（別府市・大分市周辺）
      '大畑': 'おばたけ',
      '駄原': 'だのはる',
      '千歳': 'せんざい',
      '火売': 'ほのめ',
      '上原町': 'かみはるちょう',
      '小中島': 'おなかじま',
      '羽田': 'はだ',
      '羽屋': 'はや',
      '馬場': 'ばば',
      '永興': 'りょうご',
      '寒田': 'そうだ',
      '原新町': 'はるしんまち',
      '原川': 'はるかわ',
      '豊饒': 'ぶにょう',
      '深河内': 'ふかがわうち',
      '芳河原台': 'ほうがわらだい',
      '内竈': 'うちかまど',
      '萩原': 'はぎわら',
      '政所': 'まどころ',
      '北中': 'きたぢゅう',
      '観海寺': 'かんかいじ',
      '幸町': 'さいわいちょう',
      '立田町': 'たったちょう',
      '中須賀': 'なかすか',
      '風呂本': 'ふろもと',
      '南立石生目町': 'みなみたていしいきめちょう',
      '大観山町': 'だいかんやまちょう',
      '豊海': 'とよみ',
      '古国府': 'ふるごう',
      '上人': 'しょうにん',
      '勢家町': 'せいけまち',
      '庄境': 'しょうざかい',
      '荏隈': 'えのくま',
      '丹川': 'あかがわ',
      '亀川四の湯町': 'かめがわしのゆまち',
      '萌葱台': 'もえぎだい',
      '家島': 'いえじま',
      '雄城台': 'おぎのだい',
      '三芳': 'みよし',
      '照波園': 'しょうはえん',
      '明礬': 'みょうばん',
      '玉沢': 'たまざわ',
      '金池町': 'かないけまち',
      '中央町': 'ちゅうおうまち',
      '猪野': 'いの',
      '木上': 'きのえ',
      '鶴見': 'つるみ',
      '横尾': 'よこお',
      // 福岡県
      '早良': 'さわら',
      '百道': 'ももち',
      '野芥': 'のけ',
      '椎原': 'しいば',
      '飯倉': 'いいくら',
      '原': 'はら',
      '四箇': 'しか',
      '干隈': 'ほしくま',
      '周船寺': 'すせんじ',
      '女原': 'みょうばる',
      '壱岐': 'いき',
      '愛宕': 'あたご',
      '姪浜': 'めいのはま',
      '今宿': 'いまじゅく',
      '拾六町': 'じゅうろくまち',
      '警固': 'けご',
      '荒戸': 'あらと',
      '薬院': 'やくいん',
      '浄水通': 'じょうすいどおり',
      '六本松': 'ろっぽんまつ',
      '輝国': 'てるくに',
      '鳥飼': 'とりかい',
      '地行': 'じぎょう',
      '雑餉隈': 'ざっしょのくま',
      '対馬小路': 'つましょうじ',
      '立花寺': 'りゅうげじ',
      '御供所町': 'ごくしょまち',
      '雀居': 'ささい',
      '東那珂': 'ひがしなか',
      '那珂': 'なか',
      '月隈': 'つきぐま',
      '板付': 'いたづけ',
      '別府': 'べふ',
      '茶山': 'ちゃやま',
      '七隈': 'ななくま',
      '友丘': 'ともおか',
      '神松寺': 'しんしょうじ',
      '馬出': 'まいだし',
      '箱崎': 'はこざき',
      '筥松': 'はこまつ',
      '名島': 'なじま',
      '和白': 'わじろ',
      '香椎照葉': 'かしいてりは',
      '香椎': 'かしい',
      '雁の巣': 'がんのす',
      '奈多': 'なた',
      '蒲田': 'かまた',
      '土井': 'どい',
      '唐原': 'とうのはる',
      '警弥郷': 'けやごう',
      '曰佐': 'おさ',
      '井尻': 'いじり',
      '弥永': 'やなが',
      '塩原': 'しおばる',
      '高宮': 'たかみや',
      '樋井川': 'ひいかわ',
      // 福岡県大野城市
      '牛頸': 'うしくび',
      '乙金': 'おとがな',
      '雑餉隈町': 'ざっしょのくままち',
      '白木原': 'しらきばる',
      '御笠川': 'みかさがわ',
      '筒井': 'つつい',
      '瓦田': 'かわらだ',
      '仲畑': 'なかばたけ',
      '南ケ丘': 'みなみがおか',
      '大城': 'おおき',
      '上大利': 'かみおおり',
      '下大利': 'しもおおり',
      '月の浦': 'つきのうら',
      '平野台': 'ひらのだい',
      '中央': 'ちゅうおう',
      '錦町': 'にしきまち',
      '栄町': 'さかえまち',
      '曙町': 'あけぼのまち',
      '東大利': 'ひがしおおり',
      '山田': 'やまだ',
      '畑ケ坂': 'はたがさか',
      'つつじケ丘': 'つつじがおか',
      // 福岡県春日市
      '須玖': 'すぐ',
      '須玖南': 'すぐみなみ',
      '須玖北': 'すぐきた',
      '惣利': 'そうり',
      '白水ヶ丘': 'しろうずがおか',
      '白水池': 'しろうずいけ',
      '昇町': 'のぼりまち',
      '小倉': 'おぐら',
      '大土居': 'おおどい',
      '天神山': 'てんじんやま',
      '桜ヶ丘': 'さくらがおか',
      '日の出町': 'ひのでまち',
      '大谷': 'おおたに',
      '宝町': 'たからまち',
      '岡本': 'おかもと',
      '紅葉ヶ丘東': 'もみじがおかひがし',
      '紅葉ヶ丘西': 'もみじがおかにし',
      '泉': 'いずみ',
      '弥生': 'やよい',
      '光町': 'ひかりまち',
      '千歳町': 'ちとせまち',
      '上白水': 'かみしろうず',
      '下白水': 'しもしろうず',
      '下白水北': 'しもしろうずきた',
      '春日公園': 'かすがこうえん',
      '春日原北町': 'かすがばるきたまち',
      '春日原南町': 'かすがばるみなみまち',
      '春日原東町': 'かすがばるひがしまち',
      '大和町': 'やまとまち',
      '平田台': 'ひらただい',
      '星見ヶ丘': 'ほしみがおか',
      '若葉台東': 'わかばだいひがし',
      '若葉台西': 'わかばだいにし',
      '塚原台': 'つかばるだい',
      'ちくし台': 'ちくしだい',
    };

    // 辞書マッチを試みる（「大字」を除去してから町名を抽出）
    const addressWithoutPrefix = address
      .replace(/^.*?[都道府県]/, '')  // 都道府県を除去
      .replace(/^.*?[市区町村]/, '')  // 市区町村を除去
      .replace(/^大字/, '')           // 「大字」を除去
      .replace(/[０-９0-9]+.*$/, '') // 番地以降を除去
      .replace(/[丁目番号].*$/, '')   // 丁目以降を除去
      .trim();

    // 都道府県を判定（辞書マッチの前に必要）
    const prefectureMatch = address.match(/^(.+?[都道府県])/);
    const prefecture = prefectureMatch ? prefectureMatch[1] : '';
    const isOita = prefecture.includes('大分') || address.includes('大分') || address.includes('別府市');
    const isFukuoka = prefecture.includes('福岡') || address.includes('福岡');

    // 「別府」は大分と福岡で読みが異なるため、都道府県判定後に辞書を上書き
    if (isOita) {
      localReadingDict['別府'] = 'べっぷ';
    }

    // 辞書で直接マッチする場合はOpenAI APIを呼ばずに返す
    // 長い地名から先にマッチさせる（「香椎照葉」が「香椎」より先にマッチするように）
    const sortedEntries = Object.entries(localReadingDict).sort((a, b) => b[0].length - a[0].length);

    // 区名より後ろの部分（町名以降）を抽出して、そこにマッチを絞る
    // 例: 「福岡県福岡市早良区賀茂1丁目27-7」→「賀茂1丁目27-7」
    // これにより「早良区」の「早良」が辞書マッチしなくなる
    const afterKuMatch = address.match(/[都道府県].+?[市].+?[区](.+)/);
    const addressAfterKu = afterKuMatch ? afterKuMatch[1] : null;

    for (const [placeName, reading] of sortedEntries) {
      // 区より後ろの部分がある場合はそこだけでマッチ（区名自体にヒットしないよう）
      const targetString = addressAfterKu !== null ? addressAfterKu : address;
      if (targetString.includes(placeName)) {
        return res.json({ address, reading });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEYが設定されていません' });
    }

    // systemプロンプト: 都道府県を明示することで地域固有の読み方を正確に返させる
    // 例: 「別府」は大分では「べっぷ」、福岡では「べふ」
    const prefectureNote = isOita
      ? 'この住所は大分県の地名です。大分県での正しい読み方を使用してください。例：別府→べっぷ、日田→ひた、由布→ゆふ、大畑→おばたけ、駄原→だのはる。大分県の地名は標準的な漢字の読みと異なることが多いので、必ず地元の慣用読みを使用してください。'
      : isFukuoka
        ? 'この住所は福岡県の地名です。福岡県での正しい読み方を使用してください。例：別府→べふ、博多→はかた。'
        : '';

    // 都道府県に応じた例文を切り替える
    // 「大字」は除外対象（おおあざ）であることをAIに明示するため、大分の例を用意
    let examplesText: string;
    if (isOita) {
      examplesText = `例（大分県の地名読み）:\n大分県大分市大字駄原１丁目1-1 → だのはる\n大分県大分市大字玉沢1-1 → たまざわ\n大分県大分市金池町1丁目1-1 → かないけまち\n大分県別府市大字別府1-1 → べっぷ\n大分県大分市中央町1丁目1-1 → ちゅうおうまち\n大分県別府市大字大畑42番2号 → おばたけ\n大分県大分市大字駄原2087-15 → だのはる\n大分県大分市大字羽屋1-1 → はや\n大分県大分市大字猪野1-1 → いの\n大分県大分市大字木上1-1 → きのえ\n大分県別府市大字鶴見1-1 → つるみ\n大分県大分市大字横尾1-1 → よこお\n\n重要ルール:\n1. 「大字」は「おおあざ」と読むが読み仮名には含めない。「大字駄原」→「だのはる」のみを返す。\n2. 「大畑」は「おばたけ」と読む（「おおはた」ではない）。\n3. 「駄原」は「だのはる」と読む（「だばる」「だはら」ではない）。\n4. 大分県の地名は標準的な読みと異なることが多いので、地元の慣用読みを必ず使用すること。`;
    } else {
      examplesText = `例（福岡県）:\n福岡県福岡市早良区賀茂１丁目49-11 → さわらくかも\n福岡県福岡市城南区神松寺２丁目1-1 → じょうなんくしんしょうじ\n福岡県福岡市博多区千代１丁目1-1 → はかたくせんだい\n福岡県福岡市東区香椎１丁目1-1 → ひがしくかしい\n福岡県北九州市別府１丁目1-1 → べふ`;
    }

    const axiosLib = (await import('axios')).default;
    const response = await axiosLib.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `日本の住所から区・町名部分の正確なひらがな読みだけを返すアシスタントです。都道府県・市は除外してください。「大字」という文字は除外してください（読みには含めない）。丁目・番地（数字・ハイフン）も除外してください。区と町名のひらがな読みのみを返してください。地名は地元で実際に使われている慣用的な正しい読み方を最優先で使用してください。漢字の一般的な読みではなく、その地域固有の読み方を返してください。${prefectureNote}余分な説明は不要です。`,
          },
          {
            role: 'user',
            content: `次の住所の、区と町名のひらがな読みを返してください。都道府県・市・「大字」・丁目・番地（数字・ハイフン）は全て不要です。地名の読みは正確に。\n\n${examplesText}\n\n${address}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const reading = response.data.choices[0]?.message?.content?.trim() || '';
    return res.json({ address, reading });
  } catch (error: any) {
    console.error('[address-reading] エラー:', error?.message || error);
    return res.status(500).json({ error: '読み仮名の取得に失敗しました' });
  }
});

// ============================================================
// 近隣売買物件エンドポイント（物件スプシから半径1km以内を取得）
// ============================================================

/**
 * GET /api/sellers/:id/nearby-properties
 * 売主の物件住所から半径1km以内の物件スプシ掲載物件を返す
 * Google Maps Geocoding APIで住所→座標変換し、Haversine公式で距離計算
 */
router.get('/:id/nearby-properties', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const radiusKm = parseFloat(String(req.query.radius || '1'));

    // 売主情報を取得
    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const rawAddress: string = (seller as any).propertyAddress || (seller as any).property_address || seller.address || '';
    if (!rawAddress) {
      return res.json({ results: [], address: '', lat: null, lng: null });
    }

    // 売主の座標を取得（DBに保存済みの座標を優先）
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: sellerRaw } = await supabase
      .from('sellers')
      .select('latitude, longitude')
      .eq('id', id)
      .single();

    let centerLat: number | null = sellerRaw?.latitude || null;
    let centerLng: number | null = sellerRaw?.longitude || null;

    // DBに座標がなければジオコーディング
    if (!centerLat || !centerLng) {
      const { GeocodingService } = await import('../services/GeocodingService');
      const geocodingService = new GeocodingService();
      const sellerPrefix = ((seller as any).sellerNumber || '').slice(0, 2);
      const centerCoords = await geocodingService.geocodeAddress(rawAddress, sellerPrefix);
      if (!centerCoords) {
        return res.json({ results: [], address: rawAddress, lat: null, lng: null, error: '住所の座標変換に失敗しました' });
      }
      centerLat = centerCoords.lat;
      centerLng = centerCoords.lng;
    }

    // Haversine公式
    const { GeolocationService } = await import('../services/GeolocationService');
    const geolocationService = new GeolocationService();
    const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      return geolocationService.calculateDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
    };

    // 売主の種別を取得
    const sellerPropertyType: string = (seller as any).propertyType || (seller as any).property_type || '';

    // 種別グループを判定
    const MANSION_TYPES_NP = ['マ', 'マンション'];
    const HOUSE_TYPES_NP = ['戸建', '戸', '戸建て'];
    const LAND_TYPES_NP = ['土', '土地'];

    const isMansionNP = MANSION_TYPES_NP.some(t => sellerPropertyType === t || sellerPropertyType.includes(t));
    const isHouseNP = HOUSE_TYPES_NP.some(t => sellerPropertyType === t);
    const isLandNP = LAND_TYPES_NP.some(t => sellerPropertyType === t);

    let allowedTypesNP: string[] = [];
    if (isMansionNP) {
      allowedTypesNP = [...MANSION_TYPES_NP];
    } else if (isHouseNP) {
      allowedTypesNP = [...HOUSE_TYPES_NP, ...LAND_TYPES_NP];
    } else if (isLandNP) {
      allowedTypesNP = [...LAND_TYPES_NP];
    }

    const matchesAllowedType = (rowType: string): boolean => {
      if (allowedTypesNP.length === 0) return true;
      const rt = rowType.trim();
      return allowedTypesNP.some(t => rt === t || rt.startsWith(t) || t.startsWith(rt));
    };

    // Excelシリアル値→日付文字列変換
    const excelSerialToDateStr = (value: any): string => {
      if (!value) return '';
      const str = String(value).trim();
      if (!str) return '';
      if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) return str;
      const num = parseFloat(str);
      if (!isNaN(num) && num > 1000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 86400000);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
      }
      return str;
    };

    // ── 方針：property_listingsテーブルの座標を使って距離計算（高速・正確）──
    // スプシのジオコーディングは廃止。DBに座標がある物件のみ対象。
    // 座標がない物件はスプシから住所マッチングで補完。

    // 1. property_listingsから座標付き物件を全件取得
    const { data: allListings } = await supabase
      .from('property_listings')
      .select('property_number, property_type, address, display_address, land_area, building_area, sales_price, settlement_date, atbb_status, offer_status, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    // 買付が入っている物件番号を取得（buyersテーブルのlatest_statusに「買（」を含む買主の物件）
    const { data: purchaseBuyers } = await supabase
      .from('buyers')
      .select('property_number')
      .like('latest_status', '%買（%')
      .not('property_number', 'is', null);
    const purchasePropertyNumbers = new Set(
      (purchaseBuyers || []).map((b: any) => b.property_number).filter(Boolean)
    );

    const results: any[] = [];

    if (allListings && allListings.length > 0) {
      for (const listing of allListings) {
        const lat = listing.latitude as number;
        const lng = listing.longitude as number;
        const dist = calcDistance(centerLat!, centerLng!, lat, lng);
        if (dist > radiusKm) continue;

        // 種別フィルタリング
        const rowType = String(listing.property_type || '').trim();
        if (!matchesAllowedType(rowType)) continue;

        const atbbStatus = String(listing.atbb_status || '');

        // 買付が入っている物件は除外（offer_statusに値がある場合）
        const offerStatus = String(listing.offer_status || '').trim();
        if (offerStatus !== '') continue;

        // 買主のlatest_statusに「買（」を含む物件は除外
        if (purchasePropertyNumbers.has(listing.property_number)) continue;

        let statusLabel = '';
        if (atbbStatus.includes('非公開')) statusLabel = '成約済み';
        else if (atbbStatus.includes('公開')) statusLabel = '現在募集中';
        else statusLabel = atbbStatus;

        results.push({
          propertyType: listing.property_type || '',
          settlementDate: excelSerialToDateStr(listing.settlement_date || ''),
          address: listing.address || '',
          displayAddress: listing.display_address || '',
          landArea: listing.land_area ? String(listing.land_area) : '',
          buildingArea: listing.building_area ? String(listing.building_area) : '',
          salesPrice: listing.sales_price ? String(listing.sales_price) : '',
          atbbStatus: statusLabel,
          distanceKm: Math.round(dist * 1000) / 1000,
          lat,
          lng,
        });
      }
    }

    // 距離順にソート
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      results,
      address: rawAddress,
      lat: centerLat,
      lng: centerLng,
      radiusKm,
    });
  } catch (error: any) {
    console.error('Nearby properties error:', error?.message || error);
    res.status(500).json({ error: error?.message || '近隣物件の取得に失敗しました' });
  }
});

// ============================================================
// 売買実績エンドポイント
// 売主の物件住所に基づいて物件スプシから売買実績を取得
// ============================================================

/**
 * GET /api/sellers/:id/sales-history
 * 売主の物件住所に基づいて物件スプシから売買実績を取得
 * F列「所在地」またはG列「住居表示（ATBB登録住所）」に住所が含まれる行を返す
 * 種別フィルタリング：
 *   - マ/マンション → 物件スプシの種別が同じ（マ/マンション）
 *   - 戸建/戸/戸建て → 物件スプシの種別が戸建/戸/戸建て + 土/土地
 *   - 土/土地 → 物件スプシの種別が土/土地
 */
router.get('/:id/sales-history', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 売主情報を取得
    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 物件住所を取得（property_address優先）
    const rawAddress: string = (seller as any).propertyAddress || (seller as any).property_address || seller.address || '';
    if (!rawAddress) {
      return res.json({ results: [], address: '' });
    }

    // 「大字」を除去して検索キーワードを生成
    const normalizeAddress = (addr: string): string => {
      return addr.replace(/大字/g, '').trim();
    };

    // 住所から検索キーワードを抽出
    // ルール：市区町村名の後ろ2文字まで取得
    // 例1: 「大分市乙津町3-1-2」→「大分市乙津」
    // 例2: 「大分市大字乙津町3-1-2」→「大分市乙津」（大字除去後）
    // 例3: 「大分市明野高尾明野高城1-1」→「大分市明野」
    // 例4: 「別府市大字鶴見1234」→「別府市鶴見」
    const extractSearchKeyword = (addr: string): string => {
      const normalized = normalizeAddress(addr);
      // 市・区・町・村・郡 で終わる行政区画を検出
      const cityMatch = normalized.match(/^(.+?[市区町村郡])/);
      if (!cityMatch) return normalized.slice(0, 5); // フォールバック
      const cityPart = cityMatch[1]; // 例: 「大分市」「別府市」「福岡市」
      const rest = normalized.slice(cityPart.length); // 市区町村以降
      if (!rest) return cityPart;
      // 残りの先頭2文字を取得（数字・記号・ハイフンが来たら打ち切り）
      const townMatch = rest.match(/^([^\d０-９\-－\s]{1,2})/);
      if (townMatch) return cityPart + townMatch[1];
      return cityPart;
    };

    const searchKeyword = extractSearchKeyword(rawAddress);
    if (!searchKeyword || searchKeyword.length < 3) {
      return res.json({ results: [], address: rawAddress, searchKeyword: '' });
    }

    // 売主の種別を取得
    const sellerPropertyType: string = (seller as any).propertyType || (seller as any).property_type || '';

    // 物件スプシにアクセス
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY',
      sheetName: '物件',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'google-service-account.json',
    });
    await sheetsClient.authenticate();

    // 全データを取得
    const allRows = await sheetsClient.readAll();

    // 種別グループを判定
    const MANSION_TYPES = ['マ', 'マンション'];
    const HOUSE_TYPES = ['戸建', '戸', '戸建て'];
    const LAND_TYPES = ['土', '土地'];

    const isMansion = MANSION_TYPES.some(t => sellerPropertyType === t || sellerPropertyType.includes(t));
    const isHouse = HOUSE_TYPES.some(t => sellerPropertyType === t);
    const isLand = LAND_TYPES.some(t => sellerPropertyType === t);

    // 許可する種別リストを決定
    let allowedTypes: string[] = [];
    if (isMansion) {
      allowedTypes = [...MANSION_TYPES];
    } else if (isHouse) {
      // 戸建の場合は土地も含める
      allowedTypes = [...HOUSE_TYPES, ...LAND_TYPES];
    } else if (isLand) {
      allowedTypes = [...LAND_TYPES];
    } else {
      // 種別不明の場合は全て返す
      allowedTypes = [];
    }

    // Excelシリアル値を日付文字列（YYYY/MM/DD）に変換
    const excelSerialToDateStr = (value: any): string => {
      if (!value) return '';
      const str = String(value).trim();
      if (!str) return '';
      // 既に YYYY/MM/DD or YYYY-MM-DD 形式の場合はそのまま返す
      if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(str)) return str;
      // 数値（Excelシリアル値）の場合は変換
      const num = parseFloat(str);
      if (!isNaN(num) && num > 1000) {
        // Excelのシリアル値は1900/1/1を1として計算（ただし1900/2/29バグあり）
        const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
        const date = new Date(excelEpoch.getTime() + num * 86400000);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
      }
      return str;
    };

    // 住所マッチング＋種別フィルタリング
    const searchNormalized = normalizeAddress(searchKeyword);

    const results = allRows
      .filter((row: any) => {
        // F列「所在地」またはG列「住居表示（ATBB登録住所）」に住所が含まれるか
        const address = normalizeAddress(String(row['所在地'] || ''));
        const displayAddress = normalizeAddress(String(row['住居表示（ATBB登録住所）'] || ''));
        const addressMatch = address.includes(searchNormalized) || displayAddress.includes(searchNormalized);
        if (!addressMatch) return false;

        // 種別フィルタリング
        if (allowedTypes.length === 0) return true;
        const rowType = String(row['種別'] || '').trim();
        return allowedTypes.some(t => rowType === t || rowType.startsWith(t) || t.startsWith(rowType));
      })
      .map((row: any) => {
        // atbb成約済み/非公開 → 表示ラベル変換
        const atbbStatus = String(row['atbb成約済み/非公開'] || '');
        let statusLabel = '';
        if (atbbStatus.includes('非公開')) {
          statusLabel = '成約済み';
        } else if (atbbStatus.includes('公開')) {
          statusLabel = '現在募集中';
        } else {
          statusLabel = atbbStatus;
        }

        return {
          propertyType: row['種別'] || '',
          settlementDate: excelSerialToDateStr(row['決済日'] || ''),
          address: row['所在地'] || '',
          displayAddress: row['住居表示（ATBB登録住所）'] || '',
          landArea: row['土地面積'] || '',
          buildingArea: row['建物面積'] || '',
          salesPrice: row['売買価格'] || '',
          atbbStatus: statusLabel,
        };
      });

    res.json({
      results,
      address: rawAddress,
      searchKeyword,
      sellerPropertyType,
    });
  } catch (error: any) {
    console.error('Sales history error:', error?.message || error);
    res.status(500).json({ error: error?.message || '売買実績の取得に失敗しました' });
  }
});

/**
 * POST /api/sellers/manual-sync-step1
 * 手動転記ステップ1：メール転記GAS（メール→売主リストスプシ）のみ実行
 */
router.post('/manual-sync-step1', async (_req: Request, res: Response) => {
  const STEP1_URL = 'https://script.google.com/macros/s/AKfycbyBbOeDPwwrlLX8w8xbyumP8eRjKFkYkzFjiKP0zzdeNY5M3njdEOICcH9sWpj6hQ/exec';

  try {
    console.log('[seller manual-sync-step1] GAS開始: メール→売主リストスプシ');
    const step1Res = await axios.get(STEP1_URL, { timeout: 55000 }); // Vercelの60秒制限内に収める
    const step1Data = step1Res.data;
    console.log('[seller manual-sync-step1] GAS完了:', step1Data);

    if (step1Data?.success === false) {
      return res.status(500).json({
        success: false,
        error: 'メール転記GASでエラーが発生しました',
        detail: step1Data.error,
      });
    }

    return res.json({
      success: true,
      message: 'メール→売主リストへの転記が完了しました。続けて「スプシ→DB転記」を実行してください。',
      data: step1Data,
    });
  } catch (error: any) {
    console.error('[seller manual-sync-step1] エラー:', error);
    // タイムアウトの場合はGASが裏で動き続けている可能性を伝える
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'GASの処理がタイムアウトしました。スプレッドシートを確認してから「スプシ→DB転記」を実行してください。',
        timeout: true,
      });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sellers/manual-sync-step2
 * 手動転記ステップ2：スプシ→DB転記のみ実行（additionOnly）
 */
router.post('/manual-sync-step2', async (_req: Request, res: Response) => {
  const BACKEND_URL = process.env.BACKEND_URL || 'https://sateituikyaku-admin-backend.vercel.app';
  const CRON_SECRET = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

  try {
    console.log('[seller manual-sync-step2] スプシ→DB転記開始');
    const step2Res = await axios.post(
      `${BACKEND_URL}/api/sync/trigger?additionOnly=true`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
        timeout: 55000, // Vercelの60秒制限内に収める
      }
    );
    const step2Data = step2Res.data;
    console.log('[seller manual-sync-step2] 完了:', step2Data);

    const added = step2Data?.data?.added ?? 0;
    return res.json({
      success: true,
      message: added > 0
        ? `DBへの転記が完了しました（${added}件追加）`
        : 'DBへの転記が完了しました（新規追加なし）',
      data: step2Data,
    });
  } catch (error: any) {
    console.error('[seller manual-sync-step2] エラー:', error);
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'DB転記がタイムアウトしました。しばらく待ってからもう一度実行してください。',
        timeout: true,
      });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sellers/manual-sync
 * 旧エンドポイント（後方互換性のため残す）→ step1+step2を順番に実行
 * @deprecated manual-sync-step1 と manual-sync-step2 を個別に使用してください
 */
router.post('/manual-sync', async (_req: Request, res: Response) => {
  const STEP1_URL = 'https://script.google.com/macros/s/AKfycbyBbOeDPwwrlLX8w8xbyumP8eRjKFkYkzFjiKP0zzdeNY5M3njdEOICcH9sWpj6hQ/exec';
  const BACKEND_URL = process.env.BACKEND_URL || 'https://sateituikyaku-admin-backend.vercel.app';
  const CRON_SECRET = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

  try {
    console.log('[seller manual-sync] ステップ1開始: メール転記GAS（メール→売主リストスプシ）');
    const step1Res = await axios.get(STEP1_URL, { timeout: 55000 });
    const step1Data = step1Res.data;
    console.log('[seller manual-sync] ステップ1完了:', step1Data);

    if (step1Data?.success === false) {
      return res.status(500).json({
        step: 1,
        error: 'ステップ1（メール→売主リストスプシ）でエラーが発生しました',
        detail: step1Data.error,
      });
    }

    console.log('[seller manual-sync] ステップ2開始: /api/sync/trigger（スプシ→DB、additionOnly）');
    const step2Res = await axios.post(
      `${BACKEND_URL}/api/sync/trigger?additionOnly=true`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CRON_SECRET}`,
        },
        timeout: 55000,
      }
    );
    const step2Data = step2Res.data;
    console.log('[seller manual-sync] ステップ2完了:', step2Data);

    return res.json({
      success: true,
      message: '転記が完了しました（メール→売主リスト→DB）',
      step1: step1Data,
      step2: step2Data,
    });
  } catch (error: any) {
    console.error('[seller manual-sync] エラー:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sellers/send-alert
 * メール監視サーバーからの緊急アラートメール送信
 * CRON_SECRET認証（認証ミドルウェアをバイパス）
 */
router.post('/send-alert', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { subject, body: mailBody } = req.body;
  if (!subject || !mailBody) {
    return res.status(400).json({ success: false, error: 'subject と body は必須です' });
  }

  try {
    const emailService = new EmailService();
    await emailService.sendEmail({
      to: ['tenant@ifoo-oita.com'],
      subject,
      body: mailBody,
    });
    console.log('[send-alert] アラートメール送信成功');
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[send-alert] アラートメール送信エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sellers/:id/exclusive-analysis
 * 専任媒介分析：月ごとの競合・要因・理由データとAIまとめを返す
 */
router.get('/:id/exclusive-analysis', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 売主データを取得
    const { data: seller, error } = await supabase
      .from('sellers')
      .select(`
        id,
        seller_number,
        name,
        address,
        property_address,
        status,
        contract_year_month,
        competitor_name,
        competitor_name_and_reason,
        exclusive_other_decision_factor,
        exclusive_other_decision_meeting,
        visit_assignee,
        visit_valuation_acquirer,
        phone_contact_person,
        inquiry_date
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 専任決定日（contract_year_month）が無ければ空データを返す
    const exclusiveDecisionDate = seller.contract_year_month;

    // アクティビティログから通話履歴を取得（月ごとの担当把握用）
    const { data: activities } = await supabase
      .from('activity_logs')
      .select('id, activity_type, occurred_at, assignee, notes, created_at')
      .eq('seller_id', id)
      .order('occurred_at', { ascending: false })
      .limit(200);

    // 月ごとのデータを構築
    // 専任決定日が基準：その月から現在までの各月を生成
    let monthlyData: Array<{
      yearMonth: string;       // 例: "2026-06"
      label: string;           // 例: "2026年6月"
      decisionDate: string | null;
      competitors: string[];
      factors: string[];
      reason: string;
      assignees: string[];     // その月の担当者（アクティビティログから）
    }> = [];

    if (exclusiveDecisionDate) {
      const decisionDateObj = new Date(exclusiveDecisionDate);
      const now = new Date();

      // 決定月から現在月まで列挙
      const startYear = decisionDateObj.getFullYear();
      const startMonth = decisionDateObj.getMonth(); // 0-indexed
      const endYear = now.getFullYear();
      const endMonth = now.getMonth(); // 0-indexed

      for (let y = startYear; y <= endYear; y++) {
        const mStart = (y === startYear) ? startMonth : 0;
        const mEnd = (y === endYear) ? endMonth : 11;
        for (let m = mStart; m <= mEnd; m++) {
          const ym = `${y}-${String(m + 1).padStart(2, '0')}`;
          const label = `${y}年${m + 1}月`;

          // その月のアクティビティログから担当者を収集
          const monthActivities = (activities || []).filter(a => {
            const d = new Date(a.occurred_at || a.created_at);
            return d.getFullYear() === y && d.getMonth() === m;
          });
          const assigneeSet = new Set<string>();
          monthActivities.forEach(a => {
            if (a.assignee) assigneeSet.add(a.assignee);
          });

          // 決定月のみ専任データを設定、他月は空
          const isDecisionMonth = (y === startYear && m === startMonth);

          monthlyData.push({
            yearMonth: ym,
            label,
            decisionDate: isDecisionMonth ? exclusiveDecisionDate : null,
            competitors: isDecisionMonth
              ? (seller.competitor_name || '').split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
            factors: isDecisionMonth
              ? (seller.exclusive_other_decision_factor || '').split(',').map((s: string) => s.trim()).filter(Boolean)
              : [],
            reason: isDecisionMonth ? (seller.competitor_name_and_reason || '') : '',
            assignees: Array.from(assigneeSet),
          });
        }
      }
    }

    // AIまとめ生成（Anthropic Claude使用）
    let aiSummary = '';
    try {
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicApiKey && monthlyData.length > 0) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });

        const dataForAI = monthlyData.map(m => ({
          月: m.label,
          決定日: m.decisionDate || '－',
          競合: m.competitors.length > 0 ? m.competitors.join('、') : '－',
          専任他決要因: m.factors.length > 0 ? m.factors.join('、') : '－',
          理由: m.reason || '－',
          担当者: m.assignees.length > 0 ? m.assignees.join('、') : '－',
        }));

        const prompt = `以下は不動産売主（${seller.seller_number}、物件: ${seller.property_address || seller.address}）の専任媒介取得後の月別データです。
次の担当者への引き継ぎまとめを日本語で簡潔に書いてください（300文字以内）：

${JSON.stringify(dataForAI, null, 2)}

まとめは以下の点を含めてください：
- 専任を取得できた主な要因と競合状況
- 今後の対応で注意すべき点
- 担当者への申し送り事項`;

        const message = await anthropic.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content.type === 'text') {
          aiSummary = content.text;
        }
      }
    } catch (aiErr) {
      console.error('[exclusive-analysis] AI summary error:', aiErr);
      // AIエラーはスキップ（データは返す）
    }

    return res.json({
      seller: {
        id: seller.id,
        sellerNumber: seller.seller_number,
        name: seller.name,
        propertyAddress: seller.property_address || seller.address,
        status: seller.status,
        exclusiveDecisionDate: exclusiveDecisionDate,
        visitAssignee: seller.visit_assignee,
        visitValuationAcquirer: seller.visit_valuation_acquirer,
        exclusiveOtherDecisionMeeting: seller.exclusive_other_decision_meeting,
      },
      monthlyData,
      aiSummary,
    });
  } catch (error) {
    console.error('[exclusive-analysis] Error:', error);
    return res.status(500).json({
      error: {
        code: 'EXCLUSIVE_ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get exclusive analysis',
      },
    });
  }
});

export default router;

