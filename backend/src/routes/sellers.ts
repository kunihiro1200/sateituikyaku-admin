// Seller routes - sidebar-counts endpoint is authentication-free
import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { body, query, validationResult } from 'express-validator';
import { SellerService } from '../services/SellerService.supabase';
import { authenticate } from '../middleware/auth';
import { CreateSellerRequest, ListSellersParams } from '../types';
import { PropertyDistributionAreaCalculator } from '../services/PropertyDistributionAreaCalculator';
import { CityNameExtractor } from '../services/CityNameExtractor';
import { BuyerService } from '../services/BuyerService';
import { PerformanceMetricsService } from '../services/PerformanceMetricsService';
import { SpreadsheetSyncService } from '../services/SpreadsheetSyncService';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

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
    body('sellerNumber').optional().matches(/^AA\d+$/).withMessage('Seller number must be in format AA{number}'),
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
 * 連番シート（ID: 19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs）のC2セルを読み取り、
 * "AA" + (n + 1) 形式で返す
 */
router.get('/next-seller-number', async (req: Request, res: Response) => {
  try {
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await sheetsClient.authenticate();
    const values = await sheetsClient.readRawRange('C2');
    const c2Value = values?.[0]?.[0];
    if (c2Value === undefined || c2Value === null || c2Value === '') {
      return res.status(500).json({
        error: {
          code: 'NEXT_SELLER_NUMBER_ERROR',
          message: '連番シートC2の読み取りに失敗しました',
          retryable: true,
        },
      });
    }
    const n = parseInt(String(c2Value), 10);
    if (isNaN(n)) {
      return res.status(500).json({
        error: {
          code: 'NEXT_SELLER_NUMBER_ERROR',
          message: '連番シートC2の値が数値ではありません',
          retryable: false,
        },
      });
    }
    const sellerNumber = 'AA' + String(n + 1);
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
 * 当月（JST）の first_call_person 件数をスタッフ別に集計して返す
 */
router.get('/call-ranking', async (req: Request, res: Response) => {
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

    // アプリ側で集計
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const initial = row.first_call_person as string;
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

    // アプリ側で集計
    const counts = new Map<string, number>();
    for (const row of data || []) {
      const initial = row.first_call_person as string;
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
 * 追客電話ランキングを取得
 * GET /api/sellers/call-tracking-ranking
 * Google Spreadsheet「売主追客ログ」から当月のデータを集計してランキングを返す
 */
router.get('/call-tracking-ranking', async (req: Request, res: Response) => {
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
        const initial = String(initial1).trim();
        counts.set(initial, (counts.get(initial) || 0) + 1);
      }

      // F列のイニシャルをカウント
      if (initial2 && String(initial2).trim() !== '') {
        const initial = String(initial2).trim();
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
      res.json(seller);
      // スプレッドシートに非同期で同期（レスポンスをブロックしない）
      createSpreadsheetSyncService().then(syncService => {
        if (syncService) {
          syncService.syncToSpreadsheet(req.params.id).catch(e =>
            console.error('⚠️ [SpreadsheetSync] Sync error:', e)
          );
        }
      });
      // firstCallPerson が更新された場合、スプレッドシートのY列（'1番電話'）を即時同期
      if (req.body.firstCallPerson !== undefined) {
        console.log('📞 [SpreadsheetSync] firstCallPerson updated, triggering immediate sync for Y column (1番電話)');
        createSpreadsheetSyncService().then(syncService => {
          if (syncService) {
            syncService.syncToSpreadsheet(req.params.id).then(result => {
              console.log('✅ [SpreadsheetSync] firstCallPerson sync completed:', result);
            }).catch(e =>
              console.error('⚠️ [SpreadsheetSync] firstCallPerson sync error (best-effort):', e)
            );
          }
        }).catch(e =>
          console.error('⚠️ [SpreadsheetSync] Failed to initialize sync service for firstCallPerson:', e)
        );
      }
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
    const propertyType = (typeof overridePropertyType === 'string' ? overridePropertyType : null) || seller.propertyType || null;

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
 * エリア情勢レポートを生成（AI使用）


/**
 * エリア情勢レポートを生成（AI使用）
 * POST /api/sellers/:id/area-report
 */
router.post('/:id/area-report', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const seller = await sellerService.getSeller(id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const address = seller.propertyAddress || seller.address || '';
    const propertyType = seller.propertyType || '';

    if (!address) {
      return res.status(400).json({ error: '物件住所が設定されていません' });
    }

    // OPENAI_API_KEYが未設定の場合はエラーを返す
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEYが設定されていません' });
    }

    // 住所から市区町村・町名を抽出
    // 「大分県大分市南太平寺1丁目」→ city=大分市, town=南太平寺
    // 「大分県別府市石垣東町3-9」→ city=別府市, town=石垣東
    // 都道府県の直後から最初の「市」「区」で止める（貪欲マッチを避ける）
    const prefIdx = address.search(/[都道府県]/);
    const afterPref = prefIdx >= 0 ? address.slice(prefIdx + 1) : address;
    // 「大分市」「別府市」「北九州市」など：最初の「市」または「区」で切る
    const cityEndMatch = afterPref.match(/^(.{1,6}?[市区])/);
    const city = cityEndMatch ? cityEndMatch[1] : afterPref.substring(0, 4);

    // 市の直後の町名（数字・ハイフンの手前まで）
    const cityEnd = address.indexOf(city) + city.length;
    const afterCity2 = address.slice(cityEnd);
    // 町名部分：漢字・ひらがな・カタカナのみ（数字・記号の手前まで）
    const townMatch2 = afterCity2.match(/^([\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F]{2,10}?)(?=\d|[0-9０-９\-ー－]|$)/);
    const townRaw = townMatch2 ? townMatch2[1].trim() : '';
    // 末尾の「町」「丁目番号」を除去
    const town = townRaw.replace(/[0-9０-９一二三四五六七八九十]+丁目$/, '').replace(/町$/, '').trim();
    const detailArea = town || city;
    const cityLabel = city; // 「別府市」「大分市」のみ

    // デバッグログ
    console.log('[area-report] address:', address);
    console.log('[area-report] city:', city, '| town:', town, '| detailArea:', detailArea);

    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    // AIにはJSONで数値・コメントだけ返させる（HTMLラベルはコードで制御）
    const jsonPrompt = `以下のエリアについて、不動産売却資料用のデータをJSON形式で返してください。

対象エリア: ${detailArea}（${cityLabel}内）
物件種別: ${propertyType || '不動産'}
現在年: 2026年

以下のJSON形式で返してください。数値は概算で構いません。

{
  "population": [
    {"year": "2015年", "city": 数値, "area": 数値},
    {"year": "2018年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "populationComment": "分析コメント（エリアの特徴を強調）",
  "household": [
    {"type": "単身世帯", "city": "XX%", "area": "XX%"},
    {"type": "夫婦のみ", "city": "XX%", "area": "XX%"},
    {"type": "核家族", "city": "XX%", "area": "XX%"},
    {"type": "三世代同居", "city": "XX%", "area": "XX%"}
  ],
  "householdComment": "分析コメント",
  "transactions": [
    {"year": "2020年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2022年", "city": 数値, "area": 数値},
    {"year": "2023年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "transactionsComment": "分析コメント",
  "prices": [
    {"year": "2020年", "city": 数値, "area": 数値},
    {"year": "2021年", "city": 数値, "area": 数値},
    {"year": "2022年", "city": 数値, "area": 数値},
    {"year": "2023年", "city": 数値, "area": 数値},
    {"year": "2024年", "city": 数値, "area": 数値},
    {"year": "2025年", "city": 数値, "area": 数値}
  ],
  "pricesComment": "分析コメント",
  "summary": ["理由1", "理由2", "理由3", "理由4", "理由5"]
}

JSONのみ返してください。説明文は不要です。`;

    const axios = (await import('axios')).default;
    const systemPrompt = `あなたは不動産売買仲介会社の営業担当者です。HTMLレポートを作成します。
重要ルール：表のヘッダーは必ず以下の文字列をそのまま使うこと。一字も変えてはいけない。
- 左列ヘッダー：「${cityLabel}全体」
- 右列ヘッダー：「${detailArea}エリア」
これ以外の表記（例：「${cityLabel}石垣全体」「${cityLabel}亀川全体」など）は絶対に使わないこと。`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: jsonPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const raw = completion.data.choices[0]?.message?.content || '{}';
    let data: any;
    try { data = JSON.parse(raw); } catch { data = {}; }

    // HTMLをサーバー側で組み立て（ラベルはコードで完全制御）
    const CL = cityLabel + '全体';  // 例: 「別府市全体」
    const AL = detailArea + 'エリア'; // 例: 「石垣東エリア」

    const thStyle = 'border:1px solid #90caf9;padding:6px 10px;text-align:center;';
    const tdStyle = 'border:1px solid #ccc;padding:5px 10px;text-align:center;';
    const tdAreaStyle = 'border:1px solid #ccc;padding:5px 10px;text-align:center;background:#fffde7;';

    const arrow = (cur: number, prev: number | null) => {
      if (prev === null) return '';
      if (cur > prev) return ' <span style="color:#c62828;font-weight:bold;">↑</span>';
      if (cur < prev) return ' <span style="color:#e53935;">▼</span>';
      return '';
    };

    // ① 人口の推移
    const pop = data.population || [];
    const popRows = pop.map((r: any, i: number) => {
      const prevCity = i > 0 ? pop[i-1].city : null;
      const prevArea = i > 0 ? pop[i-1].area : null;
      const bold = i === pop.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}人${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}人${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ② 世帯種類
    const hh = data.household || [];
    const hhRows = hh.map((r: any) =>
      `<tr><td style="${tdStyle}">${r.type}</td><td style="${tdStyle}">${r.city}</td><td style="${tdAreaStyle}">${r.area}</td></tr>`
    ).join('');

    // ③ 取引件数
    const tr = data.transactions || [];
    const trRows = tr.map((r: any, i: number) => {
      const prevCity = i > 0 ? tr[i-1].city : null;
      const prevArea = i > 0 ? tr[i-1].area : null;
      const bold = i === tr.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}件${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}件${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ④ 不動産価格
    const pr = data.prices || [];
    const prRows = pr.map((r: any, i: number) => {
      const prevCity = i > 0 ? pr[i-1].city : null;
      const prevArea = i > 0 ? pr[i-1].area : null;
      const bold = i === pr.length - 1 ? 'font-weight:bold;' : '';
      return `<tr><td style="${tdStyle}${bold}">${r.year}</td><td style="${tdStyle}${bold}">${Number(r.city).toLocaleString()}万円${arrow(r.city, prevCity)}</td><td style="${tdAreaStyle}${bold}">${Number(r.area).toLocaleString()}万円${arrow(r.area, prevArea)}</td></tr>`;
    }).join('');

    // ⑤ まとめ
    const summary = (data.summary || []).map((s: string) =>
      `<li style="margin-bottom:8px;"><strong style="color:#c62828;">${s}</strong></li>`
    ).join('');

    const sectionTitle = (num: string, title: string) =>
      `<h2 style="font-size:15px;color:#1a237e;border-left:4px solid #1a237e;padding-left:8px;margin-bottom:10px;">${num} ${title}</h2>`;

    const compTable = (rows: string) =>
      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead><tr style="background:#e3f2fd;">
          <th style="${thStyle}width:20%">年</th>
          <th style="${thStyle}width:40%">${CL}</th>
          <th style="${thStyle}width:40%;background:#fff9c4">${AL}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    const hhTable =
      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead><tr style="background:#e3f2fd;">
          <th style="${thStyle}width:20%">世帯種類</th>
          <th style="${thStyle}width:40%">${CL}</th>
          <th style="${thStyle}width:40%;background:#fff9c4">${AL}</th>
        </tr></thead>
        <tbody>${hhRows}</tbody>
      </table>`;

    const comment = (text: string) =>
      `<p style="font-size:11px;color:#555;background:#f5f5f5;padding:6px 10px;border-radius:4px;">📊 <strong>分析：</strong>${text}</p>`;

    const today2 = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    const htmlContent = `<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @page { size: A4; margin: 15mm; }
}
</style>
<div style="font-family:'Hiragino Kaku Gothic ProN','Meiryo',sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px;">
  <div style="text-align:center;border-bottom:3px solid #1a237e;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:10px;color:#666;margin-bottom:4px;">不動産売却のご参考資料</div>
    <h1 style="font-size:20px;color:#1a237e;margin:0 0 4px;">エリア情勢レポート</h1>
    <div style="font-size:14px;font-weight:bold;">${AL}</div>
    <div style="font-size:10px;color:#888;margin-top:4px;">作成日：${today2}　物件種別：${propertyType || '不動産'}</div>
  </div>
  <div style="margin-bottom:24px;">${sectionTitle('①', '人口の推移')}${compTable(popRows)}${comment(data.populationComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('②', '世帯種類の推移')}${hhTable}${comment(data.householdComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('③', '物件種別の取引件数推移')}${compTable(trRows)}${comment(data.transactionsComment || '')}</div>
  <div style="margin-bottom:24px;">${sectionTitle('④', '不動産価格の推移（坪単価・万円）')}${compTable(prRows)}${comment(data.pricesComment || '')}</div>
  <div style="margin-bottom:24px;background:#fffde7;border:2px solid #f9a825;border-radius:8px;padding:16px;">
    <h2 style="font-size:15px;color:#e65100;border-left:4px solid #e65100;padding-left:8px;margin-bottom:12px;">⑤ まとめ ── ${AL}で今が売却のチャンスである理由</h2>
    <ul style="margin:0;padding-left:20px;line-height:2;">${summary}</ul>
    <div style="margin-top:12px;text-align:center;background:#e65100;color:white;padding:8px;border-radius:4px;font-size:13px;font-weight:bold;">✅ ${AL}のデータが示す通り、今が最も有利な売却タイミングです</div>
  </div>
  <div style="border-top:1px solid #ccc;padding-top:8px;font-size:10px;color:#999;text-align:center;">※本レポートの数値は市場動向に基づく概算値です。実際の取引価格は個別物件の状況により異なります。</div>
</div>`;

    res.json({
      html: htmlContent,
      areaName: detailArea,
      cityLabel: cityLabel,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Area report generation error:', error?.message || error);
    const msg = error?.response?.data?.error?.message || error?.message || 'エリア情勢レポートの生成に失敗しました';
    res.status(500).json({ error: msg });
  }
});

export default router;

