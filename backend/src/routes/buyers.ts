// 買主リストのAPIルート
import { Router, Request, Response, NextFunction } from 'express';
import { BuyerService, invalidateBuyerStatusCache } from '../services/BuyerService';
import { BuyerSyncService } from '../services/BuyerSyncService';
import { EmailHistoryService } from '../services/EmailHistoryService';
import { relatedBuyerService } from '../services/RelatedBuyerService';
import { uuidValidationMiddleware } from '../middleware/uuidValidator';
import { ValidationError, NotFoundError, ServiceError } from '../errors';
import { authenticate } from '../middleware/auth';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { BuyerLinkageCache } from '../services/BuyerLinkageCache';

const router = Router();
const buyerService = new BuyerService();
const buyerSyncService = new BuyerSyncService();
const emailHistoryService = new EmailHistoryService();
const buyerLinkageCache = new BuyerLinkageCache();

// 一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      search,
      status,
      assignee,
      dateFrom,
      dateTo,
      sortBy = 'reception_date',
      sortOrder = 'desc',
      withStatus,
      calculatedStatus,
      statusCategory,
      viewingMonth,
      followUpAssignee,
    } = req.query;

    // calculatedStatus 指定の場合はステータスフィルタリング（withStatusの有無に関わらず）
    if (calculatedStatus) {
      const result = await buyerService.getBuyersByStatus(calculatedStatus as string, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });
      return res.json(result);
    }

    // withStatus=true の場合はステータス付きで全件取得
    if (withStatus === 'true') {
      const buyers = await buyerService.getBuyersWithStatus();
      return res.json({ data: buyers, total: buyers.length, page: 1, limit: buyers.length, totalPages: 1 });
    }
    const result = await buyerService.getAll({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      search: search as string,
      status: status as string,
      assignee: assignee as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      statusCategory: statusCategory as any,
      viewingMonth: viewingMonth as string,
      followUpAssignee: followUpAssignee as string,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 統計取得
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await buyerService.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching buyer stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// 物件番号バリデーション（/:id よりも前に定義）
router.get('/validate-property-number', async (req: Request, res: Response) => {
  const { number } = req.query;
  if (!number || typeof number !== 'string') {
    return res.status(400).json({ error: 'number query parameter is required' });
  }
  try {
    const exists = await buyerService.validatePropertyNumber(number.trim());
    res.json({ exists });
  } catch (error: any) {
    console.error('Error validating property number:', error);
    res.status(500).json({ error: error.message });
  }
});

// 買付率統計取得（/:id よりも前に定義）
router.get('/purchase-rate-statistics', authenticate, async (_req: Request, res: Response) => {
  try {
    console.log('[GET /buyers/purchase-rate-statistics] Request received');
    
    const statistics = await buyerService.getPurchaseRateStatistics();
    
    console.log(`[GET /buyers/purchase-rate-statistics] Success: ${statistics.length} months`);
    
    res.json({
      statistics
    });
  } catch (error: any) {
    console.error('[GET /buyers/purchase-rate-statistics] Error:', error);
    res.status(500).json({ 
      error: 'データの取得に失敗しました。しばらくしてから再度お試しください。' 
    });
  }
});

// ステータスカテゴリ一覧取得（サイドバー用）
router.get('/status-categories', async (_req: Request, res: Response) => {
  try {
    const categories = await buyerService.getStatusCategories();
    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching status categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// ステータスカテゴリのカウントのみ返す（サイドバー初期表示用・高速）
router.get('/status-categories-only', async (_req: Request, res: Response) => {
  try {
    const result = await buyerService.getStatusCategoriesOnly();
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching status categories only:', error);
    res.status(500).json({ error: error.message });
  }
});

// ステータスカテゴリ + 全買主データを一度に返す（フロントエンドキャッシュ用）
router.get('/status-categories-with-buyers', async (_req: Request, res: Response) => {
  try {
    const result = await buyerService.getStatusCategoriesWithBuyers();
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching status categories with buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// サイドバーカウントのみを高速取得（buyer_sidebar_countsテーブルから）
router.get('/sidebar-counts', async (_req: Request, res: Response) => {
  try {
    const result = await buyerService.getSidebarCounts();
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching sidebar counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// JWT認証またはAPI Key認証のいずれかを許可するミドルウェア
function authenticateOrApiKey(req: Request, res: Response, next: NextFunction) {
  // まずAPI Keyの存在を確認
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    // API Keyが存在する場合、API Key認証を試みる
    console.log('[authenticateOrApiKey] API Key detected, using API Key auth');
    return apiKeyAuth(req, res, next);
  }
  
  // API Keyが存在しない場合、JWT認証を試みる
  console.log('[authenticateOrApiKey] No API Key, using JWT auth');
  return authenticate(req, res, next);
}

// 🚨 重要: GAS用のバッチ更新エンドポイント（API Key認証）
// router.use(authenticate)よりも前に定義する必要がある
router.put('/batch', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const { buyers } = req.body;

    console.log('[PUT /buyers/batch] ===== START =====');
    console.log('[PUT /buyers/batch] buyers count:', buyers?.length || 0);

    // 基本的なバリデーション
    if (!buyers || !Array.isArray(buyers) || buyers.length === 0) {
      return res.status(400).json({ error: 'buyers array is required and must not be empty' });
    }

    // バッチサイズ制限（1回のリクエストで最大100件）
    if (buyers.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 buyers per batch request' });
    }

    // Get user info from request (set by auth middleware)
    const userId = (req as any).user?.id || 'system';
    const userEmail = (req as any).user?.email || 'system@example.com';

    // バッチ更新を実行
    const results = await buyerService.updateBatch(buyers, userId, userEmail);

    console.log('[PUT /buyers/batch] Batch update completed');
    console.log('[PUT /buyers/batch] Success:', results.success);
    console.log('[PUT /buyers/batch] Failed:', results.failed);

    res.json({
      success: results.success,
      failed: results.failed,
      total: buyers.length,
      results: results.results
    });
  } catch (error: any) {
    console.error('[PUT /buyers/batch] Error in batch update:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pinrich500万以上登録 同メアド一括更新
router.patch('/pinrich-500man-bulk-update', async (req: Request, res: Response) => {
  try {
    const { email, pinrich_500man_registration } = req.body;
    if (!email || !pinrich_500man_registration) {
      return res.status(400).json({ error: 'email and pinrich_500man_registration are required' });
    }
    const result = await buyerService.bulkUpdatePinrich500man(email.trim(), pinrich_500man_registration);
    res.json({ success: true, updatedCount: result });
  } catch (error: any) {
    console.error('Error bulk updating pinrich_500man_registration:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🚨 重要: GAS用のPUT /api/buyers/:id エンドポイント（API Key認証）
// router.use(authenticate)よりも前に定義する必要がある
router.put('/:id', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { force, sync } = req.query;

    console.log('[PUT /buyers/:id] ===== START =====');
    console.log('[PUT /buyers/:id] id:', id);
    console.log('[PUT /buyers/:id] updateData:', JSON.stringify(updateData, null, 2));
    console.log('[PUT /buyers/:id] query params:', { force, sync });

    // 基本的なバリデーション
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Update data is required' });
    }

    // 更新不可フィールドを自動的に除外（エラーにせず、単に無視する）
    const protectedFields = ['id', 'db_created_at', 'synced_at', 'created_at', 'updated_at'];
    const sanitizedData = { ...updateData };
    protectedFields.forEach(field => {
      delete sanitizedData[field];
    });

    // 除外後にデータが空になった場合はエラー
    if (Object.keys(sanitizedData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Get user info from request (set by auth middleware)
    const userId = (req as any).user?.id || 'system';
    const userEmail = (req as any).user?.email || 'system@example.com';

    // idがUUIDか買主番号かを判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let buyerNumber = id;

    console.log(`[PUT /buyers/:id] id=${id}, isUuid=${isUuid}`);

    // UUIDの場合は買主番号を取得（後方互換性のため）
    if (isUuid) {
      const buyer = await buyerService.getById(id);
      console.log(`[PUT /buyers/:id] getById result:`, buyer ? `found (buyer_number=${buyer.buyer_number})` : 'not found');
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerNumber = buyer.buyer_number; // buyer_numberを取得
    }

    console.log(`[PUT /buyers/:id] buyerNumber=${buyerNumber}`);

    // 🚨 重要：デフォルトで即時同期を有効にする（sync=false の場合のみ同期なし）
    // これにより、DBで編集した内容が即座にスプレッドシートに反映される
    if (sync === 'false') {
      // sync=falseが明示的に指定された場合のみ、同期なしで更新
      console.log('[PUT /buyers/:id] Using update (sync=false explicitly specified)');
      const updatedBuyer = await buyerService.update(buyerNumber, sanitizedData, userId, userEmail);
      console.log('[PUT /buyers/:id] Update completed successfully (no sync)');
      return res.json(updatedBuyer);
    }

    // DB更新とスプレッドシート同期を順番に実行（Vercelサーバーレス対応）
    console.log('[PUT /buyers/:id] Using updateWithSync (DB + spreadsheet sync)');
    const syncResult = await buyerService.updateWithSync(
      buyerNumber,
      sanitizedData,
      userId,
      userEmail,
      { force: force === 'true' }
    );
    console.log('[PUT /buyers/:id] updateWithSync completed, syncStatus:', syncResult.syncResult.syncStatus);

    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log('[PUT /buyers/:id] Buyer status cache invalidated');

    return res.json({
      ...syncResult.buyer,
      syncStatus: syncResult.syncResult.syncStatus,
    });
  } catch (error: any) {
    console.error('[PUT /buyers/:id] Error updating buyer:', error);
    
    if (error.message === 'Buyer not found') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// buyer_sidebar_countsテーブルを更新（バックエンドから直接実行）
// 認証不要（公開エンドポイント）
router.post('/update-sidebar-counts', async (_req: Request, res: Response) => {
  try {
    console.log('[POST /buyers/update-sidebar-counts] ===== START =====');
    
    const result = await buyerService.updateSidebarCountsTable();
    
    if (result.success) {
      console.log(`[POST /buyers/update-sidebar-counts] ===== SUCCESS ===== (${result.rowsInserted} rows inserted)`);
      res.json({
        success: true,
        rowsInserted: result.rowsInserted,
        message: `buyer_sidebar_counts table updated successfully (${result.rowsInserted} rows inserted)`
      });
    } else {
      console.error(`[POST /buyers/update-sidebar-counts] ===== FAILED =====:`, result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('[POST /buyers/update-sidebar-counts] ===== ERROR =====:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 内覧ダブルブッキングチェック
// 同じ物件・同じ日（日本時間）・異なる後続担当の内覧を検索する
// viewingDate は日本時間の YYYY-MM-DD 形式でフロントから渡される
router.get('/viewing-double-booking-check', async (req: Request, res: Response) => {
  try {
    const { propertyNumber, viewingDate, currentBuyerNumber } = req.query as {
      propertyNumber: string;
      viewingDate: string; // 日本時間 YYYY-MM-DD
      currentBuyerNumber: string;
    };

    if (!propertyNumber || !viewingDate) {
      return res.status(400).json({ error: 'propertyNumber and viewingDate are required' });
    }

    // viewingDate が YYYY-MM-DD 形式であることを確認
    if (!/^\d{4}-\d{2}-\d{2}$/.test(viewingDate)) {
      return res.status(400).json({ error: 'viewingDate must be YYYY-MM-DD format' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 同じ物件・同じ内覧日の買主を取得（自分以外）
    const { data: candidates, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, viewing_date, viewing_time, follow_up_assignee')
      .eq('property_number', propertyNumber)
      .eq('viewing_date', viewingDate)
      .neq('buyer_number', currentBuyerNumber || '')
      .not('viewing_time', 'is', null)
      .not('follow_up_assignee', 'is', null)
      .is('deleted_at', null);

    if (error) {
      console.error('[viewing-double-booking-check] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!candidates || candidates.length === 0) {
      return res.json({ conflicts: [] });
    }

    // 当日・同じ物件で異なる後続担当の内覧を抽出
    const currentAssignee = req.query.followUpAssignee as string || '';
    const conflicts = candidates.filter((c: any) => {
      if (!c.follow_up_assignee) return false;

      // 「業者」同士は別物扱い（常にconflict対象）
      // 同じ後続担当（業者以外）なら問題なし
      if (currentAssignee && currentAssignee !== '業者' && c.follow_up_assignee !== '業者') {
        if (currentAssignee === c.follow_up_assignee) return false;
      }

      return true;
    });

    res.json({ conflicts });
  } catch (error: any) {
    console.error('[viewing-double-booking-check] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 既存買主の物件情報をproperty_listingsから一括バックフィルしてスプシに同期
router.post('/backfill-property-info', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    console.log('[POST /buyers/backfill-property-info] Starting backfill...');

    const supabase = (buyerService as any).supabase;

    // property_numberが入っている買主を全件取得（受付日2026/4/1以降 & property_numberあり）
    const { data: buyers, error: buyersError } = await supabase
      .from('buyers')
      .select('buyer_number, property_number')
      .not('property_number', 'is', null)
      .neq('property_number', '')
      .is('deleted_at', null)
      .gte('reception_date', '2026-04-01');

    if (buyersError) {
      throw new Error(`Failed to fetch buyers: ${buyersError.message}`);
    }

    if (!buyers || buyers.length === 0) {
      return res.json({ success: true, message: '対象の買主が見つかりませんでした', updated: 0, skipped: 0 });
    }

    console.log(`[backfill] Found ${buyers.length} buyers with property_number`);

    // property_listingsからCH〜CN列の値を一括取得
    const propertyNumbers = [...new Set(buyers.map((b: any) => b.property_number).filter(Boolean))];
    const { data: propertyListings, error: plError } = await supabase
      .from('property_listings')
      .select('property_number, address, display_address, price, sales_assignee, pre_viewing_notes, viewing_key, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking')
      .in('property_number', propertyNumbers);

    if (plError) {
      throw new Error(`Failed to fetch property_listings: ${plError.message}`);
    }

    // property_number → property_listings のマップを作成
    const plMap: Record<string, any> = {};
    for (const pl of propertyListings ?? []) {
      plMap[pl.property_number] = pl;
    }

    console.log(`[backfill] property_listings found: ${Object.keys(plMap).length}件`);

    let updated = 0;
    let skipped = 0;

    await (buyerService as any).initSyncServices();
    const writeService = (buyerService as any).writeService;

    for (const buyer of buyers) {
      try {
        const pl = plMap[buyer.property_number];
        if (!pl) {
          console.log(`[backfill] No property_listing for buyer ${buyer.buyer_number} (property_number: ${buyer.property_number})`);
          skipped++;
          continue;
        }

        const updatePayload: Record<string, any> = {
          property_address: pl.address ?? null,
          display_address: pl.display_address ?? null,
          price: pl.price ?? null,
          property_assignee: pl.sales_assignee ?? null,
          pre_viewing_notes: pl.pre_viewing_notes ?? null,
          key_info: pl.viewing_key ?? null,           // CI列: 鍵等（property_listingsのviewing_keyカラム）
          sale_reason: pl.sale_reason ?? null,
          price_reduction_history: pl.price_reduction_history ?? null,
          viewing_notes: pl.viewing_notes ?? null,
          parking: pl.parking ?? null,
          viewing_parking: pl.viewing_parking ?? null,
        };

        // DBを更新
        await supabase
          .from('buyers')
          .update(updatePayload)
          .eq('buyer_number', buyer.buyer_number);

        // スプシに同期
        if (writeService) {
          await writeService.updateFields(buyer.buyer_number, updatePayload);
        }

        updated++;
        console.log(`[backfill] Updated buyer ${buyer.buyer_number} (property: ${buyer.property_number})`);
      } catch (err: any) {
        console.error(`[backfill] Failed for buyer ${buyer.buyer_number}:`, err.message);
        skipped++;
      }
    }

    console.log(`[backfill] Done. updated=${updated}, skipped=${skipped}`);
    res.json({ success: true, updated, skipped, total: buyers.length });

  } catch (error: any) {
    console.error('[POST /buyers/backfill-property-info] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// スプレッドシートの物件番号列を読み取り、DBでnullになっている買主を一括修復
// POST /api/buyers/repair-property-numbers
// スプシのE列（買主番号）とF列相当の「物件番号」列を突き合わせてDBを更新する
router.post('/repair-property-numbers', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';
    console.log(`[POST /buyers/repair-property-numbers] START dryRun=${dryRun}`);

    const { google } = await import('googleapis');
    const pathMod = await import('path');
    const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
    const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

    // Google認証（get-sheet-buyer-numbersと同じパターン）
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let authConfig: any;
    if (saJson) {
      try {
        const creds = JSON.parse(saJson);
        authConfig = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      } catch {
        authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      }
    } else {
      authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    }
    const auth = new google.auth.GoogleAuth(authConfig);
    const sheets = google.sheets({ version: 'v4', auth });

    // スプレッドシートのヘッダー行を取得して「物件番号」列のインデックスを特定
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!1:1`,
    });
    const headers: string[] = (headerResponse.data.values?.[0] || []).map((h: any) => String(h));

    // E列（0-indexed: 4）が買主番号、「物件番号」列のインデックスを動的に取得
    const buyerNumberColIdx = 4; // E列固定
    const propertyNumberColIdx = headers.indexOf('物件番号');

    if (propertyNumberColIdx === -1) {
      return res.status(500).json({ success: false, error: 'スプレッドシートに「物件番号」列が見つかりません' });
    }
    console.log(`[repair-property-numbers] 物件番号列インデックス: ${propertyNumberColIdx} (${headers[propertyNumberColIdx]})`);

    // 全データ行を取得
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A2:GZ`,
    });
    const rows = dataResponse.data.values || [];
    console.log(`[repair-property-numbers] スプレッドシート行数: ${rows.length}`);

    // スプレッドシートから「買主番号 → 物件番号」マップを作成（物件番号が空でない行のみ）
    const sheetPropertyMap: Record<string, string> = {};
    for (const row of rows) {
      const buyerNum = String(row[buyerNumberColIdx] || '').trim();
      const propNum = String(row[propertyNumberColIdx] || '').trim();
      if (buyerNum && /^\d+$/.test(buyerNum) && propNum) {
        sheetPropertyMap[buyerNum] = propNum;
      }
    }
    console.log(`[repair-property-numbers] スプシで物件番号あり: ${Object.keys(sheetPropertyMap).length}件`);

    // DBでproperty_numberがnullまたは空の買主を全件取得
    const supabase = (buyerService as any).supabase;
    const { data: nullBuyers, error: dbError } = await supabase
      .from('buyers')
      .select('buyer_number, property_number')
      .is('deleted_at', null)
      .or('property_number.is.null,property_number.eq.');

    if (dbError) {
      throw new Error(`DB取得エラー: ${dbError.message}`);
    }

    console.log(`[repair-property-numbers] DBでproperty_numberがnull/空の買主: ${(nullBuyers || []).length}件`);

    // 修復対象を特定（スプシに物件番号がある買主のみ）
    const targets: Array<{ buyerNumber: string; propertyNumber: string }> = [];
    for (const buyer of nullBuyers || []) {
      const sheetPropNum = sheetPropertyMap[buyer.buyer_number];
      if (sheetPropNum) {
        targets.push({ buyerNumber: buyer.buyer_number, propertyNumber: sheetPropNum });
      }
    }

    console.log(`[repair-property-numbers] 修復対象: ${targets.length}件`);

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: `ドライラン: ${targets.length}件が修復対象です`,
        targets,
        nullBuyersTotal: (nullBuyers || []).length,
        sheetHasPropertyNumber: Object.keys(sheetPropertyMap).length,
      });
    }

    // 一括修復
    let repaired = 0;
    let failed = 0;
    const errors: Array<{ buyerNumber: string; error: string }> = [];

    for (const target of targets) {
      try {
        const { error: updateError } = await supabase
          .from('buyers')
          .update({
            property_number: target.propertyNumber,
            db_updated_at: new Date().toISOString(),
          })
          .eq('buyer_number', target.buyerNumber);

        if (updateError) {
          throw new Error(updateError.message);
        }
        repaired++;
        console.log(`[repair-property-numbers] ✓ ${target.buyerNumber} → ${target.propertyNumber}`);
      } catch (err: any) {
        failed++;
        errors.push({ buyerNumber: target.buyerNumber, error: err.message });
        console.error(`[repair-property-numbers] ✗ ${target.buyerNumber}: ${err.message}`);
      }
    }

    console.log(`[repair-property-numbers] 完了: 修復=${repaired}, 失敗=${failed}`);
    res.json({
      success: true,
      message: `${repaired}件の物件番号を修復しました`,
      repaired,
      failed,
      nullBuyersTotal: (nullBuyers || []).length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[POST /buyers/repair-property-numbers] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 半径検索用の買主取得（認証必須だが、router.use(authenticate)の前に定義）
router.post('/radius-search', authenticate, async (req: Request, res: Response) => {
  try {
    const { address, priceRange, propertyTypes, pet, parking, onsen, floor } = req.body;

    // バリデーション
    if (!address || !propertyTypes || propertyTypes.length === 0) {
      return res.status(400).json({ 
        error: 'address and propertyTypes are required' 
      });
    }

    const result = await buyerService.getBuyersByRadiusSearch({
      address,
      priceRange: priceRange || '指定なし',
      propertyTypes,
      pet: pet || 'どちらでも',
      parking: parking || '指定なし',
      onsen: onsen || 'どちらでも',
      floor: floor || 'どちらでも',
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching buyers by radius:', error);
    
    // ジオコーディングエラーの場合
    if (error.message.includes('geocoding')) {
      return res.status(400).json({ 
        error: '住所を地理座標に変換できませんでした。住所を確認してください。' 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});


// DBにあってスプレッドシートにない買主を検出してスプシに書き戻す
// POST /api/buyers/restore-to-sheet
// body: { buyerNumbers: string[], dryRun?: boolean }
// 書き戻すべき買主番号リストを直接指定（スプシ取得・DB全件取得不要）
router.post('/restore-to-sheet', authenticateOrApiKey, async (req: Request, res: Response) => {
  try {
    const buyerNumbers: string[] = req.body?.buyerNumbers || [];
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === 'true';

    console.log(`[POST /buyers/restore-to-sheet] buyerNumbers=${buyerNumbers.length}件, dryRun=${dryRun}`);

    if (buyerNumbers.length === 0) {
      return res.json({ success: true, message: '処理対象なし', batchSize: 0, restored: 0, failed: 0 });
    }

    // BuyerWriteServiceを初期化
    await (buyerService as any).initSyncServices();
    const writeService = (buyerService as any).writeService as import('../services/BuyerWriteService').BuyerWriteService;
    if (!writeService) {
      return res.status(500).json({ error: 'BuyerWriteService の初期化に失敗しました' });
    }

    // 指定された買主番号のDBデータを取得
    const supabase = (buyerService as any).supabase;
    const { data: buyers, error: dbError } = await supabase
      .from('buyers')
      .select('*')
      .is('deleted_at', null)
      .in('buyer_number', buyerNumbers);

    if (dbError) throw new Error(`DB取得エラー: ${dbError.message}`);
    console.log(`[restore-to-sheet] DB取得: ${(buyers || []).length}件`);

    if (!buyers || buyers.length === 0 || dryRun) {
      return res.json({
        success: true,
        message: dryRun ? `ドライラン: ${(buyers || []).length}件が対象` : '処理対象なし',
        batchSize: (buyers || []).length,
        restored: 0,
        failed: 0,
      });
    }

    // スプシに書き戻す
    let restored = 0;
    let failed = 0;
    const errors: Array<{ buyerNumber: string; error: string }> = [];

    for (const buyer of buyers) {
      try {
        const result = await writeService.appendNewBuyer(buyer);
        if (result.success) { restored++; }
        else {
          failed++;
          errors.push({ buyerNumber: buyer.buyer_number, error: result.error || 'Unknown' });
        }
      } catch (err: any) {
        failed++;
        errors.push({ buyerNumber: buyer.buyer_number, error: err.message });
      }
    }

    console.log(`[restore-to-sheet] 完了: 成功=${restored}, 失敗=${failed}`);

    res.json({
      success: true,
      message: `${restored}件をスプレッドシートに書き戻しました`,
      batchSize: buyers.length,
      restored,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[POST /buyers/restore-to-sheet] エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// スプシのE列（買主番号）一覧を返す軽量エンドポイント
// POST /api/buyers/get-sheet-buyer-numbers
router.post('/get-sheet-buyer-numbers', authenticateOrApiKey, async (_req: Request, res: Response) => {
  try {
    const { google } = await import('googleapis');
    const pathMod = await import('path');
    const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
    const sheetName = process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト';

    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    let authConfig: any;
    if (saJson) {
      try {
        const creds = JSON.parse(saJson);
        authConfig = { credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      } catch {
        authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
      }
    } else {
      authConfig = { keyFile: pathMod.join(__dirname, '../../google-service-account.json'), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] };
    }
    const auth = new google.auth.GoogleAuth(authConfig);
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!E:E`,
    });
    const sheetValues = sheetResponse.data.values || [];
    const buyerNumbers = sheetValues.slice(1)
      .map((row: any[]) => String(row[0] || '').trim())
      .filter((v: string) => v && /^\d+$/.test(v));

    res.json({ success: true, buyerNumbers, count: buyerNumbers.length });
  } catch (error: any) {
    console.error('[POST /buyers/get-sheet-buyer-numbers] エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// 全てのルートに認証を適用（sidebar-countsの後、PUT /:id の後に配置）
router.use(authenticate);

// 次の買主番号を取得（/:id よりも前に定義する必要がある）
router.get('/next-buyer-number', async (_req: Request, res: Response) => {
  try {
    const buyerNumber = await (buyerService as any).generateBuyerNumber();
    res.json({ buyerNumber });
  } catch (error: any) {
    console.error('Error generating buyer number:', error);
    res.status(500).json({ error: error.message });
  }
});

// 同期実行
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    if (buyerSyncService.isSyncInProgress()) {
      return res.status(409).json({ error: 'Sync is already in progress' });
    }

    const result = await buyerSyncService.syncAll();
    
    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log('[POST /buyers/sync] Buyer status cache invalidated');
    
    res.json(result);
  } catch (error: any) {
    console.error('Error syncing buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 同期ステータス取得
router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const stats = await buyerSyncService.getSyncStats();
    const isSyncing = buyerSyncService.isSyncInProgress();
    
    res.json({
      isSyncing,
      ...stats
    });
  } catch (error: any) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: error.message });
  }
});


// 検索
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = '20' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await buyerService.search(q as string, parseInt(limit as string, 10));
    res.json(results);
  } catch (error: any) {
    console.error('Error searching buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// CSVエクスポート
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { search, status, assignee, dateFrom, dateTo } = req.query;

    const data = await buyerService.getExportData({
      search: search as string,
      status: status as string,
      assignee: assignee as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
    });

    // CSVヘッダー
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data to export' });
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n') 
            ? `"${str}"` 
            : str;
        }).join(',')
      )
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=buyers_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csvRows.join('\n')); // BOM for Excel
  } catch (error: any) {
    console.error('Error exporting buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 新規買主作成
router.post('/', async (req: Request, res: Response) => {
  try {
    const buyerData = req.body;

    // 基本的なバリデーション
    if (!buyerData.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const newBuyer = await buyerService.create(buyerData);
    res.status(201).json(newBuyer);
  } catch (error: any) {
    console.error('Error creating buyer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== 具体的なルート（/:id よりも前に定義する必要がある） =====

// 紐づく物件取得
router.get('/:id/properties', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // buyer_numberをそのまま使用（UUID判定不要）
    const properties = await buyerService.getLinkedProperties(id);
    res.json(properties);
  } catch (error: any) {
    console.error('Error fetching linked properties:', error);
    res.status(500).json({ error: error.message });
  }
});

// 過去買主番号取得
router.get('/:id/past-buyer-numbers', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pastBuyerNumbers = await buyerService.getPastBuyerNumbers(id);
    res.json(pastBuyerNumbers);
  } catch (error: any) {
    console.error('Error fetching past buyer numbers:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// 完全な問い合わせ履歴取得（旧形式）
router.get('/:id/inquiry-history-legacy', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await buyerService.getCompleteInquiryHistory(id);
    res.json(history);
  } catch (error: any) {
    console.error('Error fetching inquiry history:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// 問い合わせ履歴取得（買主詳細ページ用）
router.get('/:id/inquiry-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // UUIDかどうかで判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // 買主番号の場合はそのまま使用、UUIDの場合は買主番号を取得
    let buyerNumber = id;
    if (isUuid) {
      const buyer = await buyerService.getById(id);
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerNumber = buyer.buyer_number;
    }
    
    const inquiryHistory = await buyerService.getInquiryHistory(buyerNumber);
    res.json({ inquiryHistory });
  } catch (error: any) {
    console.error('Error fetching inquiry history:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// メール送信履歴を保存
router.post('/:buyerId/email-history', async (req: Request, res: Response) => {
  try {
    const { buyerId } = req.params;
    const { propertyNumbers, recipientEmail, subject, body, sentBy, emailType } = req.body;

    // Validation
    if (!propertyNumbers || !Array.isArray(propertyNumbers) || propertyNumbers.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: propertyNumbers array is required and cannot be empty',
      });
    }

    if (!recipientEmail || typeof recipientEmail !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: recipientEmail is required',
      });
    }

    if (!subject || !body) {
      return res.status(400).json({
        error: 'Invalid request: subject and body are required',
      });
    }

    if (!sentBy) {
      return res.status(400).json({
        error: 'Invalid request: sentBy is required',
      });
    }

    // Save email history
    const historyIds = await emailHistoryService.saveEmailHistory({
      buyerId,
      propertyNumbers,
      recipientEmail,
      subject,
      body,
      senderEmail: sentBy,
      emailType,
    });

    res.json({
      success: true,
      message: 'Email history saved successfully',
      historyIds,
    });
  } catch (error: any) {
    console.error('Error saving email history:', error);
    res.status(500).json({ error: error.message });
  }
});

// メール送信履歴を取得
router.get('/:buyerId/email-history', async (req: Request, res: Response) => {
  try {
    const { buyerId } = req.params;
    
    // email_history.buyer_id は buyer_number で保存されているため、
    // UUID が渡された場合は buyer_number に変換する
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(buyerId);
    let buyerNumber = buyerId;
    if (isUuid) {
      const buyer = await buyerService.getById(buyerId);
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerNumber = buyer.buyer_number;
    }
    
    const emailHistory = await emailHistoryService.getEmailHistory(buyerNumber);
    res.json({ emailHistory });
  } catch (error: any) {
    console.error('Error fetching email history:', error);
    res.status(500).json({ error: error.message });
  }
});

// 関連買主を取得
router.get('/:id/related', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  try {
    console.log(`[API] GET /buyers/${id}/related - Request received`);
    
    // UUIDかどうかで判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // 買主番号の場合は、まずbuyer_idを取得
    let buyerId = id;
    if (!isUuid) {
      console.log(`[API] Resolving buyer number ${id} to UUID`);
      const buyer = await buyerService.getByBuyerNumber(id, true);
      if (!buyer) {
        console.warn(`[API] Buyer not found for buyer_number: ${id}`);
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Buyer not found',
          code: 'BUYER_NOT_FOUND',
          details: { buyer_number: id }
        });
      }
      buyerId = buyer.buyer_id;
      console.log(`[API] Resolved buyer_number ${id} to UUID ${buyerId}`);
    }
    
    // 現在の買主を取得
    const currentBuyer = await buyerService.getById(buyerId);
    if (!currentBuyer) {
      console.warn(`[API] Buyer not found for UUID: ${buyerId}`);
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Buyer not found',
        code: 'BUYER_NOT_FOUND',
        details: { buyer_id: buyerId }
      });
    }

    // 関連買主を検索
    const relatedBuyers = await relatedBuyerService.findRelatedBuyers(buyerId);
    
    const duration = Date.now() - startTime;
    console.log(`[API] GET /buyers/${id}/related - Success (${duration}ms, ${relatedBuyers.length} related buyers)`);

    res.json({
      current_buyer: currentBuyer,
      related_buyers: relatedBuyers,
      total_count: relatedBuyers.length
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[API] GET /buyers/${id}/related - Error (${duration}ms):`, error);
    
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        code: 'BUYER_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to fetch related buyers',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 統合問合せ履歴を取得
router.get('/:id/unified-inquiry-history', uuidValidationMiddleware('id'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  try {
    console.log(`[API] GET /buyers/${id}/unified-inquiry-history - Request received`);
    
    // UUIDかどうかで判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // 買主番号の場合は、まずbuyer_idを取得
    let buyerId = id;
    if (!isUuid) {
      console.log(`[API] Resolving buyer number ${id} to UUID`);
      const buyer = await buyerService.getByBuyerNumber(id);
      if (!buyer) {
        console.warn(`[API] Buyer not found for buyer_number: ${id}`);
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Buyer not found',
          code: 'BUYER_NOT_FOUND',
          details: { buyer_number: id }
        });
      }
      buyerId = buyer.buyer_id;
      console.log(`[API] Resolved buyer_number ${id} to UUID ${buyerId}`);
    }
    
    // 現在の買主を取得
    const currentBuyer = await buyerService.getById(buyerId);
    if (!currentBuyer) {
      console.warn(`[API] Buyer not found for UUID: ${buyerId}`);
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Buyer not found',
        code: 'BUYER_NOT_FOUND',
        details: { buyer_id: buyerId }
      });
    }

    // 関連買主を取得
    const relatedBuyers = await relatedBuyerService.findRelatedBuyers(buyerId);
    
    // 全ての買主IDを集める
    const allBuyerIds = [buyerId, ...relatedBuyers.map(rb => rb.id)];
    
    // 統合問合せ履歴を取得
    const inquiries = await relatedBuyerService.getUnifiedInquiryHistory(allBuyerIds);
    
    // 買主番号のリストを作成
    const buyerNumbers = [
      currentBuyer.buyer_number,
      ...relatedBuyers.map(rb => rb.buyer_number)
    ];
    
    const duration = Date.now() - startTime;
    console.log(`[API] GET /buyers/${id}/unified-inquiry-history - Success (${duration}ms, ${inquiries.length} inquiries)`);
    
    if (duration > 1000) {
      console.warn(`[API] Slow query detected: ${duration}ms for buyer ${id}`);
    }

    res.json({
      inquiries,
      buyer_numbers: buyerNumbers
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[API] GET /buyers/${id}/unified-inquiry-history - Error (${duration}ms):`, error);
    
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: error.message,
        code: 'BUYER_NOT_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to fetch unified inquiry history',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 競合チェックエンドポイント（GET）
router.get('/:id/conflict-check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { field, timestamp } = req.query;

    if (!field || !timestamp) {
      return res.status(400).json({ error: 'field and timestamp are required' });
    }

    // UUIDかどうかで判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // 買主番号の場合は、まずbuyer_idを取得
    let buyerId = id;
    if (!isUuid) {
      const buyer = await buyerService.getByBuyerNumber(id);
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerId = buyer.buyer_id;
    }

    // 買主を取得
    const buyer = await buyerService.getById(buyerId);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    // 競合チェック: last_synced_atがtimestampより新しい場合は競合
    const clientTimestamp = new Date(timestamp as string);
    const lastSyncedAt = buyer.last_synced_at ? new Date(buyer.last_synced_at) : null;
    const dbUpdatedAt = buyer.db_updated_at ? new Date(buyer.db_updated_at) : null;

    // 競合判定: DBが更新されていて、かつクライアントのタイムスタンプより新しい場合
    const hasConflict = dbUpdatedAt && dbUpdatedAt > clientTimestamp;

    if (hasConflict) {
      return res.json({
        hasConflict: true,
        conflictingValue: buyer[field as string],
        conflictingUser: 'another user', // TODO: 実際のユーザー情報を取得
        conflictingTimestamp: dbUpdatedAt?.toISOString()
      });
    }

    return res.json({
      hasConflict: false
    });
  } catch (error: any) {
    console.error('Error checking conflict:', error);
    res.status(500).json({ error: error.message });
  }
});

// 競合解決エンドポイント
router.post('/:id/conflict', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, conflicts } = req.body;

    // resolution: 'db_wins' | 'spreadsheet_wins' | 'manual'
    if (!resolution) {
      return res.status(400).json({ error: 'Resolution strategy is required' });
    }

    // Get user info from request
    const userId = (req as any).user?.id || 'system';
    const userEmail = (req as any).user?.email || 'system@example.com';

    // 買主を取得
    const buyer = await buyerService.getById(id);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    if (resolution === 'db_wins') {
      // DBの値でスプレッドシートを強制上書き
      // conflictsから更新するフィールドを抽出
      const updateData: Record<string, any> = {};
      if (conflicts && Array.isArray(conflicts)) {
        for (const conflict of conflicts) {
          updateData[conflict.fieldName] = conflict.dbValue;
        }
      }

      // force=trueで更新を実行
      const result = await buyerService.updateWithSync(
        id,
        updateData,
        userId,
        userEmail,
        { force: true }
      );

      return res.json({
        success: true,
        buyer: result.buyer,
        syncStatus: result.syncResult.syncStatus
      });
    } else if (resolution === 'spreadsheet_wins') {
      // スプレッドシートの値を維持（DBを更新しない）
      // last_synced_atを更新して競合状態を解消
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      await supabase
        .from('buyers')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', id);

      return res.json({
        success: true,
        message: 'Spreadsheet values preserved',
        syncStatus: 'synced'
      });
    } else {
      return res.status(400).json({ error: 'Invalid resolution strategy' });
    }
  } catch (error: any) {
    console.error('Error resolving conflict:', error);
    res.status(500).json({ error: error.message });
  }
});

// 近隣物件取得（類似物件）
router.get('/:buyerNumber/nearby-properties', async (req: Request, res: Response) => {
  try {
    const { buyerNumber } = req.params;
    const { propertyNumber } = req.query;

    if (!propertyNumber) {
      return res.status(400).json({ error: 'propertyNumber is required' });
    }

    const result = await buyerService.getNearbyProperties(propertyNumber as string);
    res.json(result);
  } catch (error: any) {
    console.error('Error fetching nearby properties:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 共通: activity_logs から buyer の通話履歴を全件取得してスタッフ別に集計
 */
async function fetchBuyerCallRankings(
  fromUtcIso: string,
  toUtcIso: string,
): Promise<Map<string, number>> {
  const supabase = (await import('../config/supabase')).default;

  const counts = new Map<string, number>();
  const PAGE_SIZE = 1000;
  let from = 0;

  // Supabaseは1回1000件上限のためページネーションで全件取得
  while (true) {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('employee_id, employee:employees(id, name, initials)')
      .in('action', ['phone_call', 'call'])
      .eq('target_type', 'buyer')
      .gte('created_at', fromUtcIso)
      .lt('created_at', toUtcIso)
      .not('employee_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const emp = (row as any).employee;
      if (!emp) continue;
      // 姓（スペース前）を表示名として使用、なければinitials
      const displayName = emp.name
        ? emp.name.split(/[\s　]/)[0]
        : (emp.initials || '不明');
      counts.set(displayName, (counts.get(displayName) || 0) + 1);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return counts;
}

/**
 * 月間電話ランキングを取得
 * GET /api/buyers/call-ranking
 * 指定月（またはJST当月）の activity_logs（action=phone_call, target_type=buyer）を
 * 担当者名別に集計して返す
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

    // JST月初 00:00:00 → UTC
    const fromJst = new Date(Date.UTC(year, month, 1, 0, 0, 0) - jstOffset);
    // JST翌月初 00:00:00 → UTC（lt で使う）
    const toJst = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0) - jstOffset);

    const fromDateLabel = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDateLabel = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const counts = await fetchBuyerCallRankings(
      fromJst.toISOString(),
      toJst.toISOString(),
    );

    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    console.log(`[/api/buyers/call-ranking] 月間 ${fromDateLabel}〜${toDateLabel}: ${rankings.reduce((s, r) => s + r.count, 0)}件`);

    res.json({
      period: { from: fromDateLabel, to: toDateLabel },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get buyer call ranking error:', error);
    res.status(500).json({
      error: {
        code: 'BUYER_CALL_RANKING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get buyer call ranking',
        retryable: true,
      },
    });
  }
});

/**
 * 年間電話ランキングを取得
 * GET /api/buyers/call-ranking-yearly
 * 2026年1月1日から現在までの activity_logs（action=phone_call, target_type=buyer）を
 * 担当者名別に集計して返す
 */
router.get('/call-ranking-yearly', async (req: Request, res: Response) => {
  try {
    const jstOffset = 9 * 60 * 60 * 1000;

    // JST 2026-01-01 00:00:00 → UTC
    const fromJst = new Date(Date.UTC(2026, 0, 1, 0, 0, 0) - jstOffset);

    // JSTで翌月初 → UTC（lt で使う）
    const now = new Date();
    const jstNow = new Date(now.getTime() + jstOffset);
    const year = jstNow.getUTCFullYear();
    const month = jstNow.getUTCMonth();
    const toJst = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0) - jstOffset);

    const fromDateLabel = '2026-01-01';
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const toDateLabel = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const counts = await fetchBuyerCallRankings(
      fromJst.toISOString(),
      toJst.toISOString(),
    );

    const rankings = Array.from(counts.entries())
      .map(([initial, count]) => ({ initial, count }))
      .sort((a, b) => b.count - a.count || a.initial.localeCompare(b.initial));

    console.log(`[/api/buyers/call-ranking-yearly] 年間 ${fromDateLabel}〜${toDateLabel}: ${rankings.reduce((s, r) => s + r.count, 0)}件`);

    res.json({
      period: { from: fromDateLabel, to: toDateLabel },
      rankings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get buyer call ranking yearly error:', error);
    res.status(500).json({
      error: {
        code: 'BUYER_CALL_RANKING_YEARLY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get yearly buyer call ranking',
        retryable: true,
      },
    });
  }
});

// 他社物件新着配信用の買主取得
router.get('/other-company-distribution', authenticate, async (req: Request, res: Response) => {
  try {
    const { area, priceRange, propertyTypes, propertyNumber } = req.query;

    // バリデーション（areaまたはpropertyNumberのいずれかが必須）
    if (!area && !propertyNumber) {
      return res.status(400).json({ error: 'area or propertyNumber is required' });
    }

    if (!propertyTypes) {
      return res.status(400).json({ error: 'propertyTypes is required' });
    }

    const propertyTypesArray = Array.isArray(propertyTypes) 
      ? propertyTypes 
      : [propertyTypes];

    const result = await buyerService.getOtherCompanyDistributionBuyers({
      area: area as string | undefined,
      priceRange: (priceRange as string) || '指定なし',
      propertyTypes: propertyTypesArray as string[],
      propertyNumber: propertyNumber as string | undefined,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching other company distribution buyers:', error);
    res.status(500).json({ error: error.message });
  }
});

// 他社物件新着配信用スクレイピングプロキシ（CORS回避のためバックエンド経由）
// /scrape-preview を使用（DBに保存しない・建売専門HPの /scrape とは完全に独立）
router.post('/scrape-property', authenticate, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';

    // /scrape-preview を使用（DBに保存しない・他社物件配信専用エンドポイント）
    // ※ /scrape は建売専門HP専用（DBに保存する）なので絶対に使わない
    const scrapeRes = await fetch(`${scrapeApiUrl}/scrape-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text();
      console.error('[buyers/scrape-property] スクレイピングサーバーエラー:', scrapeRes.status, errText);
      return res.status(scrapeRes.status).json({ error: `スクレイピングサーバーエラー: ${scrapeRes.status}` });
    }

    const result = await scrapeRes.json();
    return res.json(result);
  } catch (err: any) {
    console.error('[buyers/scrape-property] エラー:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 他社物件新着配信用SUUMOスクレイピング（DBに保存しない・プレビューのみ）
router.post('/scrape-property-suumo', authenticate, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'url is required' });
    }
    if (!url.includes('suumo.jp')) {
      return res.status(400).json({ success: false, error: 'SUUMOのURLを入力してください' });
    }

    console.log(`[buyers/scrape-property-suumo] 開始: ${url}`);

    // SUUMOのHTMLを取得
    const htmlRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://suumo.jp/',
      },
    });

    if (!htmlRes.ok) {
      return res.status(500).json({ success: false, error: `SUUMO取得失敗: HTTP ${htmlRes.status}` });
    }

    const html = await htmlRes.text();

    // タグを除去してテキストを取得するヘルパー
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // --- タイトル ---
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : null;
    if (title) {
      title = title.replace(/【[^】]+】/g, '').replace(/\s*[-|｜].*$/, '').trim();
    }

    // --- 物件概要テーブルから各フィールドを抽出するヘルパー ---
    const extractField = (label: string): string | null => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        escaped + '[\\s\\S]{0,200}?<\\/th>[\\s\\S]{0,50}?<td[^>]*>([\\s\\S]{1,300}?)<\\/td>',
        'i'
      );
      const m = html.match(pattern);
      if (!m) return null;
      const text = stripTags(m[1])
        .replace(/ヒント/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    };

    // --- 価格 ---
    let price = extractField('価格');
    if (price) price = price.replace(/支払.*$/, '').replace(/□.*$/, '').trim();
    if (!price) {
      const m = html.match(/(\d{3,5}万円(?:[～〜]\d{3,5}万円)?)/);
      if (m) price = m[1];
    }

    // --- 住所 ---
    let address = extractField('所在地');
    if (!address) {
      const m = html.match(/所在地\s*<\/[^>]+>\s*([\s\S]{1,200}?)(?:<\/td>|<\/dd>|\[)/);
      if (m) address = stripTags(m[1]).replace(/\[.*?\]/g, '').trim();
    }

    // --- 間取り ---
    let layout = extractField('間取り');
    if (layout) {
      const lm = layout.match(/[1-9][SLDK+]+/);
      if (lm) layout = lm[0];
    }

    // --- 建物面積 ---
    let area = extractField('建物面積');
    if (area) {
      area = area.replace(/\s+/g, '');
      const am = area.match(/[\d.]+m2[^（(]*/);
      if (am) area = am[0].trim();
    }

    // --- 土地面積 ---
    let landArea = extractField('土地面積');
    if (landArea) {
      landArea = landArea.replace(/\s+/g, '');
      const lam = landArea.match(/[\d.]+m2[^（(]*/);
      if (lam) landArea = lam[0].trim();
    }

    // --- 交通 ---
    let access = extractField('交通');
    if (access) {
      access = access.replace(/\[.*?\]/g, '').replace(/乗り換え案内.*$/, '').trim();
      if (access.length > 80) access = access.substring(0, 80) + '...';
    }
    if (!access) {
      const trainMatch = html.match(/((?:地下鉄|西鉄|JR|東急|京急|阪急|近鉄)[^\n<「」]{5,60}(?:分|歩\d+分))/);
      if (trainMatch) access = trainMatch[1].trim();
    }

    // --- アピールコメント ---
    let appeal_comment: string | null = null;
    const pickupMatch = html.match(/特徴ピックアップ[\s\S]{0,100}?<[^>]*>([\s\S]{50,2000}?)<\/(?:p|div|dd)>/i);
    if (pickupMatch) {
      appeal_comment = stripTags(pickupMatch[1]).replace(/\s+/g, ' ').trim();
    }
    if (!appeal_comment) {
      const appealM = html.match(/担当者より[\s\S]{0,500}?<p[^>]*>([\s\S]{20,500}?)<\/p>/i);
      if (appealM) appeal_comment = stripTags(appealM[1]).trim();
    }

    // --- 提供元情報 ---
    let provider_name: string | null = null;
    let provider_phone: string | null = null;

    const contactMatch = html.match(/お問い?合わ?せ先[\s\S]{0,500}?<\/(?:th|dt)>[\s\S]{0,100}?<(?:td|dd)[^>]*>([\s\S]{10,500}?)<\/(?:td|dd)>/i);
    if (contactMatch) {
      const contactText = stripTags(contactMatch[1]);
      const companyMatch = contactText.match(/([（(]株[）)]|株式会社|有限会社|合同会社|[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店))[^\n\r]{0,50}/);
      if (companyMatch) provider_name = companyMatch[0].trim();
      const phoneMatch = contactText.match(/TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i);
      if (phoneMatch) provider_phone = phoneMatch[1].replace(/\s+/g, '').trim();
    }
    if (!provider_name) {
      const companyPatterns = [
        /([（(]株[）)]|株式会社|有限会社|合同会社)\s*[ァ-ヶー\w]+/,
        /[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店|住宅)/,
      ];
      for (const pattern of companyPatterns) {
        const match = html.match(pattern);
        if (match) { provider_name = match[0].trim(); break; }
      }
    }
    if (!provider_phone) {
      const phonePatterns = [
        /TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /電話\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /\b(0\d{1,4}[-]\d{1,4}[-]\d{4})\b/,
      ];
      for (const pattern of phonePatterns) {
        const match = html.match(pattern);
        if (match) { provider_phone = match[1].replace(/\s+/g, '').trim(); break; }
      }
    }

    // --- 緯度経度 ---
    let lat: number | null = null;
    let lng: number | null = null;

    const latKw = html.match(/['"_]lat['"_\s:=]+([3][0-9]\.[0-9]{4,})/i);
    const lngKw = html.match(/['"_]lng['"_\s:=]+([1][2-4][0-9]\.[0-9]{4,})/i);
    if (latKw) lat = parseFloat(latKw[1]);
    if (lngKw) lng = parseFloat(lngKw[1]);

    if (!lat || !lng) {
      const latNums = [...html.matchAll(/\b([3][0-9]\.[0-9]{6,})\b/g)].map(m => parseFloat(m[1]));
      const lngNums = [...html.matchAll(/\b(1[2-4][0-9]\.[0-9]{6,})\b/g)].map(m => parseFloat(m[1]));
      if (latNums.length > 0) lat = latNums[0];
      if (lngNums.length > 0) lng = lngNums[0];
    }

    if (!lat || !lng) {
      const dataLat = html.match(/data-lat[='":\s]+([3][0-9]\.[0-9]{4,})/i);
      const dataLng = html.match(/data-lng[='":\s]+([1][2-4][0-9]\.[0-9]{4,})/i);
      if (dataLat) lat = parseFloat(dataLat[1]);
      if (dataLng) lng = parseFloat(dataLng[1]);
    }

    // --- 画像 ---
    const images: string[] = [];

    // パターン1: resizeImage URL
    const resizeImageMatches = html.matchAll(/https:\/\/img01\.suumo\.com\/jj\/resizeImage\?src=gazo%2Fbukken%2F[^"'\s<>,]+?\.jpg[^"'\s<>,]*/gi);
    for (const match of resizeImageMatches) {
      let imgUrl = match[0];
      imgUrl = imgUrl.replace(/&amp;/g, '&');
      imgUrl = imgUrl.split(',')[0];
      imgUrl = imgUrl.replace(/&w=96&h=72/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=220&h=165/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=452&h=339/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=296&h=222/g, '&w=800&h=600');
      imgUrl = imgUrl.replace(/&w=500/g, '&w=800&h=600');
      if (!imgUrl.includes('kaisha') && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // パターン2: data-src属性
    const dataSrcMatches = html.matchAll(/data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
    for (const match of dataSrcMatches) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      else if (imgUrl.startsWith('/')) imgUrl = 'https://suumo.jp' + imgUrl;
      const shouldExclude =
        imgUrl.includes('/icon/') || imgUrl.includes('/logo') || imgUrl.includes('/banner') ||
        imgUrl.includes('/btn_') || imgUrl.includes('/common/') || imgUrl.includes('/edit/assets/') ||
        imgUrl.includes('/edit/include/') || imgUrl.includes('/pagetop') ||
        imgUrl.includes('_logo') || imgUrl.includes('_icon') || imgUrl.includes('_btn');
      if (!images.includes(imgUrl) && imgUrl.includes('suumo') && !shouldExclude) {
        images.push(imgUrl);
      }
    }

    // パターン3: src属性
    const srcMatches = html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
    for (const match of srcMatches) {
      let imgUrl = match[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      else if (imgUrl.startsWith('/')) imgUrl = 'https://suumo.jp' + imgUrl;
      const shouldExclude =
        imgUrl.includes('/icon/') || imgUrl.includes('/logo') || imgUrl.includes('/banner') ||
        imgUrl.includes('/btn_') || imgUrl.includes('/common/') || imgUrl.includes('/edit/assets/') ||
        imgUrl.includes('/edit/include/') || imgUrl.includes('/pagetop') ||
        imgUrl.includes('_logo') || imgUrl.includes('_icon') || imgUrl.includes('_btn');
      if (!images.includes(imgUrl) && imgUrl.includes('suumo') && !shouldExclude) {
        images.push(imgUrl);
      }
    }

    console.log(`[buyers/scrape-property-suumo] 完了: title=${title}, price=${price}, images=${images.length}枚`);

    // DBに保存してプレビューURLを生成
    const { createClient: createSbClient } = require('@supabase/supabase-js');
    const { randomBytes } = require('crypto');
    const supabase = createSbClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const slug = randomBytes(6).toString('hex');

    const payload = {
      slug,
      source_url: url,
      title,
      price,
      address,
      access,
      layout,
      area,
      images,
      lat,
      lng,
      appeal_comment,
      provider_name,
      provider_phone,
      is_tateuri: false,
      is_active: true,
      region: 'distribution', // 他社物件配信用（建売HPとは区別）
    };

    const { error: insertError } = await supabase
      .from('property_previews')
      .insert(payload);

    if (insertError) {
      console.error('[buyers/scrape-property-suumo] DB保存エラー:', insertError);
      // DB保存に失敗してもスクレイピングデータは返す
    }

    const preview_url = insertError
      ? url // DB保存失敗時は元URLを返す
      : `https://sateituikyaku-admin-frontend.vercel.app/property-preview/${slug}`;

    const data = {
      title,
      price,
      address,
      access,
      layout,
      area,
      images,
      lat,
      lng,
      appeal_comment,
      provider_name,
      provider_phone,
      details: {
        '土地面積': landArea,
      },
    };

    return res.json({
      success: true,
      data,
      preview_url,
    });
  } catch (err: any) {
    console.error('[buyers/scrape-property-suumo] エラー:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// スクレイピングサーバーのヘルスチェック（Vercel Cron Job用）
// 定期的にpingして、サーバーが落ちていたら自動復旧を促す
router.get('/cron/scrape-server-ping', async (req: Request, res: Response) => {
  try {
    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25秒タイムアウト

    try {
      const pingRes = await fetch(`${scrapeApiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      console.log(`[scrape-server-ping] status=${pingRes.status}, elapsed=${elapsed}ms`);
      return res.json({ success: true, status: pingRes.status, elapsed });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      console.error(`[scrape-server-ping] failed: ${fetchErr.message}, elapsed=${elapsed}ms`);
      return res.json({ success: false, error: fetchErr.message, elapsed });
    }
  } catch (err: any) {
    console.error('[scrape-server-ping] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ===== 汎用ルート（最後に定義する必要がある） =====

// 気づき（viewing_insight）が入力されている全買主を取得
// ⚠️ /:id より前に定義必須（"insights"がidとして解釈されるのを防ぐ）
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const supabase = (buyerService as any).supabase;
    const { data, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, property_number, property_address, viewing_date, follow_up_assignee, viewing_insight_executor, viewing_insight_companion')
      .is('deleted_at', null)
      .or('viewing_insight_executor.neq.,viewing_insight_companion.neq.')
      .order('viewing_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('[GET /buyers/insights] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 個別取得（ID）
router.get('/:id', async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { id } = req.params;
    
    // UUIDかどうかで判定
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    const data = isUuid 
      ? await buyerService.getById(id)
      : await buyerService.getByBuyerNumber(id);
    
    console.log(`[GET /buyers/${id}] ${Date.now() - t0}ms`);
    
    if (!data) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error(`[GET /buyers/:id] error after ${Date.now() - t0}ms:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 買主を論理削除
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let buyerId = id;
    if (!isUuid) {
      const buyer = await buyerService.getByBuyerNumber(id);
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerId = buyer.buyer_id;
    }

    // 削除前に買主情報を取得（latest_status と property_number を確認するため）
    const buyerBeforeDelete = await buyerService.getById(buyerId);

    await buyerService.softDelete(buyerId);

    // 削除対象買主の latest_status に「買」が含まれる場合、
    // 紐づく物件の offer_status を直接DBで更新する
    if (buyerBeforeDelete && buyerBeforeDelete.latest_status?.includes('買') && buyerBeforeDelete.property_number) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // 同一物件に他の「買」ステータス買主が存在するか確認（削除済みを除く）
      const { data: remainingBuyers } = await supabase
        .from('buyers')
        .select('buyer_id, latest_status')
        .eq('property_number', buyerBeforeDelete.property_number)
        .neq('buyer_id', buyerId)
        .is('deleted_at', null);

      const hasOtherPurchaseBuyer = (remainingBuyers || []).some(
        (b: { buyer_id: string; latest_status: string | null }) => b.latest_status?.includes('買')
      );

      // 他に「買」ステータス買主がいない場合のみ offer_status をクリア
      if (!hasOtherPurchaseBuyer) {
        await supabase
          .from('property_listings')
          .update({ offer_status: '' })
          .eq('property_number', buyerBeforeDelete.property_number);
        console.log(`[DELETE /buyers/:id] offer_status cleared for property: ${buyerBeforeDelete.property_number}`);
      } else {
        console.log(`[DELETE /buyers/:id] offer_status NOT cleared (other purchase buyers exist) for property: ${buyerBeforeDelete.property_number}`);
      }

      // 買主リストキャッシュを無効化（削除後すぐにヘッダーに反映されるように）
      await buyerLinkageCache.invalidate(buyerBeforeDelete.property_number);
      console.log(`[DELETE /buyers/:id] buyer list cache invalidated for property: ${buyerBeforeDelete.property_number}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting buyer:', error);
    if (error.message === 'Buyer not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// 買主を物理削除（完全削除）
router.delete('/:id/permanent', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // buyer_number（数値文字列）をそのまま permanentDelete に渡す
    // permanentDelete 内で buyer_number TEXT カラムで削除する
    await buyerService.permanentDelete(id);

    // キャッシュを無効化（サイドバー・リストが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log(`[DELETE /buyers/${id}/permanent] cache invalidated`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error permanently deleting buyer:', error);
    if (error.message === 'Buyer not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// 論理削除した買主を復元
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let buyerId = id;
    if (!isUuid) {
      const buyer = await buyerService.getByBuyerNumber(id, true); // includeDeleted=true
      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }
      buyerId = buyer.buyer_id;
    }

    const restored = await buyerService.restore(buyerId);
    res.json(restored);
  } catch (error: any) {
    console.error('Error restoring buyer:', error);
    res.status(500).json({ error: error.message });
  }
});

// 買主へのメール送信
router.post('/:id/send-email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { to, subject, content, htmlBody } = req.body;

    if (!to || !subject || !content) {
      return res.status(400).json({ error: '宛先、件名、本文は必須です' });
    }

    const buyer = await buyerService.getByBuyerNumber(id);
    if (!buyer) {
      return res.status(404).json({ error: '買主が見つかりません' });
    }

    console.log('Sending email to buyer:', {
      buyerNumber: id,
      to,
      subject,
      content: content.substring(0, 100) + '...',
    });

    res.json({
      success: true,
      message: 'メールを送信しました',
    });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    res.status(500).json({ error: error.message || 'メール送信に失敗しました' });
  }
});

// 買主へのSMS送信記録
router.post('/:id/send-sms', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'メッセージは必須です' });
    }

    const buyer = await buyerService.getByBuyerNumber(id);
    if (!buyer) {
      return res.status(404).json({ error: '買主が見つかりません' });
    }

    console.log('Recording SMS to buyer:', {
      buyerNumber: id,
      phoneNumber: buyer.phone_number,
      message: message.substring(0, 100) + '...',
    });

    res.json({
      success: true,
      message: 'SMS送信を記録しました',
    });
  } catch (error: any) {
    console.error('Failed to record SMS:', error);
    res.status(500).json({ error: error.message || 'SMS送信記録に失敗しました' });
  }
});

// 通話履歴を activity_logs に記録
router.post('/:buyerNumber/call-history', async (req: Request, res: Response) => {
  try {
    const { buyerNumber } = req.params;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber は必須です' });
    }

    const buyer = await buyerService.getByBuyerNumber(buyerNumber);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    const SYSTEM_EMPLOYEE_ID = '66e35f74-7c31-430d-b235-5ad515581007';
    const { ActivityLogService } = require('../services/ActivityLogService');
    const activityLogService = new ActivityLogService();
    await activityLogService.logActivity({
      employeeId: (req as any).employee?.id || SYSTEM_EMPLOYEE_ID,
      action: 'phone_call',
      targetType: 'buyer',
      targetId: buyerNumber,
      metadata: {
        phoneNumber,
        buyerNumber,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to record call history:', error);
    res.status(500).json({ error: error.message || '通話履歴記録に失敗しました' });
  }
});

// SMS送信履歴を activity_logs に記録
router.post('/:buyerNumber/sms-history', async (req: Request, res: Response) => {
  try {
    const { buyerNumber } = req.params;
    const { templateId, templateName, phoneNumber, senderName } = req.body;

    // 必須フィールドのバリデーション
    if (!templateId || !templateName || !phoneNumber) {
      return res.status(400).json({ error: 'templateId, templateName, phoneNumber は必須です' });
    }

    // 買主の存在確認
    const buyer = await buyerService.getByBuyerNumber(buyerNumber);
    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    // activity_logs に記録
    // employee_id が NOT NULL のため、未ログイン時は「会社アカウント」のIDをフォールバックとして使用
    const SYSTEM_EMPLOYEE_ID = '66e35f74-7c31-430d-b235-5ad515581007'; // 会社アカウント
    const { ActivityLogService } = require('../services/ActivityLogService');
    const activityLogService = new ActivityLogService();
    await activityLogService.logActivity({
      employeeId: (req as any).user?.id || SYSTEM_EMPLOYEE_ID,
      action: 'sms',
      targetType: 'buyer',
      targetId: buyerNumber,
      metadata: {
        templateId,
        templateName,
        phoneNumber,
        buyerNumber,
        senderName: senderName || '',
      },
    });

    // 挿入されたレコードのIDを取得
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: logData } = await supabase
      .from('activity_logs')
      .select('id')
      .eq('action', 'sms')
      .eq('target_type', 'buyer')
      .eq('target_id', buyerNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ success: true, logId: logData?.id || null });
  } catch (error: any) {
    console.error('Failed to record SMS history:', error);
    res.status(500).json({ error: error.message || 'SMS履歴記録に失敗しました' });
  }
});

// 買付チャット送信（買付情報・買付外れ情報をGoogle Chatに送信）
router.post('/:buyer_number/send-offer-chat', async (req: Request, res: Response) => {
  try {
    const { buyer_number } = req.params;
    const { propertyNumber, offerComment, campaignHandedOver } = req.body;

    const buyer = await buyerService.getByBuyerNumber(buyer_number);
    if (!buyer) {
      return res.status(404).json({ success: false, error: '買主が見つかりませんでした' });
    }

    const properties = await buyerService.getLinkedProperties(buyer.buyer_number);
    const property = properties && properties.length > 0 ? properties[0] : null;

    const latestStatus = buyer.latest_status || '';
    const isOfferFailed = !latestStatus.includes('買') || latestStatus === '買付外れました';

    const frontendBaseUrl = 'https://sateituikyaku-admin-frontend.vercel.app';
    const detailUrl = `${frontendBaseUrl}/buyers/${buyer_number}/viewing-result`;

    let message: string;
    if (isOfferFailed) {
      message =
        `【買付外れ】\n` +
        `買主番号: ${buyer.buyer_number}\n` +
        `買主名: ${buyer.name || '未設定'}\n` +
        `物件番号: ${propertyNumber || property?.property_number || '未設定'}\n` +
        `物件所在地: ${property?.address || property?.display_address || '未設定'}\n` +
        `★最新状況: ${latestStatus || '（空欄）'}\n` +
        `買付ハズレコメント: ${offerComment || '未記入'}\n` +
        `${detailUrl}`;
    } else {
      message =
        `【買付情報】\n` +
        `買主番号: ${buyer.buyer_number}\n` +
        `買主名: ${buyer.name || '未設定'}\n` +
        `物件番号: ${propertyNumber || property?.property_number || '未設定'}\n` +
        `物件所在地: ${property?.address || property?.display_address || '未設定'}\n` +
        `★最新状況: ${latestStatus}\n` +
        `買付コメント: ${offerComment || '未記入'}\n` +
        `10万円キャンペーン: ${campaignHandedOver ? 'お渡し済み ✅' : '未渡し'}\n` +
        `${detailUrl}`;
    }

    const OFFER_WEBHOOK_URL =
      'https://chat.googleapis.com/v1/spaces/AAAA6iEDkiU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=azlyf21pENCpLLUdJPjnRNXOzsIAP550xebOMVxYRMQ';

    const { GoogleChatService } = require('../services/GoogleChatService');
    const chatService = new GoogleChatService();
    const sendResult = await chatService.sendMessage(OFFER_WEBHOOK_URL, message);

    if (!sendResult.success) {
      return res.status(500).json({ success: false, error: sendResult.error || 'チャット送信に失敗しました' });
    }

    res.json({ success: true, message: '送信しました' });
  } catch (error: any) {
    console.error('[POST /buyers/:buyer_number/send-offer-chat] Exception:', error);
    res.status(500).json({ success: false, error: `チャット送信に失敗しました: ${error.message}` });
  }
});

// 担当への確認事項をGoogle Chatに送信
router.post('/:buyer_number/send-confirmation', async (req: Request, res: Response) => {
  try {
    const { buyer_number } = req.params;
    const { confirmationText, buyerDetailUrl } = req.body;

    console.log('[POST /buyers/:buyer_number/send-confirmation] Request received:', {
      buyer_number,
      confirmationTextLength: confirmationText?.length || 0,
      buyerDetailUrl
    });

    if (!confirmationText || confirmationText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '確認事項を入力してください'
      });
    }

    const buyer = await buyerService.getByBuyerNumber(buyer_number);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: '買主が見つかりませんでした'
      });
    }

    if (!buyer.property_number || buyer.property_number.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '物件番号が設定されていません'
      });
    }

    const properties = await buyerService.getLinkedProperties(buyer.buyer_number);
    if (!properties || properties.length === 0) {
      return res.status(400).json({
        success: false,
        error: '紐づく物件が見つかりませんでした'
      });
    }

    const firstProperty = properties[0];
    if (!firstProperty.sales_assignee || firstProperty.sales_assignee.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '物件担当者が設定されていません'
      });
    }

    const assigneeName = firstProperty.sales_assignee;

    const { StaffManagementService } = require('../services/StaffManagementService');
    const staffService = new StaffManagementService();
    const webhookResult = await staffService.getWebhookUrl(assigneeName);

    if (!webhookResult.success) {
      return res.status(404).json({
        success: false,
        error: webhookResult.error || '担当者のWebhook URLが取得できませんでした'
      });
    }

    const webhookUrl = webhookResult.webhookUrl;

    const price = firstProperty.price || firstProperty.sales_price || firstProperty.listing_price;
    const priceFormatted = price
      ? `${(price / 10000).toLocaleString()}万円`
      : '未設定';

    const detailUrl = buyerDetailUrl || `https://www.appsheet.com/start/8f0d5296-d256-411a-9a64-a13f2e034d8f#view=%E8%B2%B7%E4%B8%BB%E3%83%AA%E3%82%B9%E3%83%88_Detail&row=${buyer.buyer_number}`;

    let message = `問合せありました: 
　【初動担当】${buyer.initial_assignee || '未設定'}【連絡先】${buyer.assignee_phone || '未設定'}
【物件所在地】 ${firstProperty.display_address || firstProperty.address || '未設定'}
【価格】${priceFormatted}
【★問合せ内容】${confirmationText}
 【問合せ者氏名】${buyer.name || '未設定'}`;

    if (buyer.company_name && buyer.company_name.trim().length > 0) {
      message += `
【法人の場合法人名】${buyer.company_name}`;
      if (buyer.broker_inquiry && buyer.broker_inquiry.trim().length > 0) {
        message += `
【仲介の有無】${buyer.broker_inquiry}`;
      }
    }

    message += `
【問合せ者電話番号】 ${buyer.phone_number || '未設定'}
${detailUrl}`;

    const { GoogleChatService } = require('../services/GoogleChatService');
    const chatService = new GoogleChatService();
    const sendResult = await chatService.sendMessage(webhookUrl, message);

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: sendResult.error || 'メッセージの送信に失敗しました'
      });
    }

    // チャット送信成功後、confirmation_to_assignee をDBに保存してスプレッドシートに同期（BJ列）
    try {
      console.log('[send-confirmation] Starting sync of confirmation_to_assignee for buyer:', buyer_number);
      const syncResult = await buyerService.updateWithSync(
        buyer_number,
        { confirmation_to_assignee: confirmationText },
        'system',
        'system@example.com',
        { force: true }
      );
      console.log('[send-confirmation] Sync result:', JSON.stringify({
        syncStatus: syncResult.syncResult.syncStatus,
        success: syncResult.syncResult.success,
        error: syncResult.syncResult.error,
      }));
    } catch (syncError: any) {
      console.error('[send-confirmation] Failed to sync confirmation_to_assignee:', syncError.message, syncError.stack?.substring(0, 300));
    }

    res.json({
      success: true,
      message: '送信しました'
    });

  } catch (error: any) {
    console.error('[POST /buyers/:buyer_number/send-confirmation] Exception:', error);
    res.status(500).json({
      success: false,
      error: `メッセージの送信に失敗しました: ${error.message}`
    });
  }
});





export default router;
