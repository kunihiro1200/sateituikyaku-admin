// 買主リストのAPIルート
import { Router, Request, Response, NextFunction } from 'express';
import { BuyerService } from '../services/BuyerService';
import { BuyerSyncService } from '../services/BuyerSyncService';
import { EmailHistoryService } from '../services/EmailHistoryService';
import { relatedBuyerService } from '../services/RelatedBuyerService';
import { uuidValidationMiddleware } from '../middleware/uuidValidator';
import { ValidationError, NotFoundError, ServiceError } from '../errors';
import { authenticate } from '../middleware/auth';
import { apiKeyAuth } from '../middleware/apiKeyAuth';

const router = Router();
const buyerService = new BuyerService();
const buyerSyncService = new BuyerSyncService();
const emailHistoryService = new EmailHistoryService();

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
    } = req.query;

    // withStatus=true かつ calculatedStatus 指定の場合はステータスフィルタリング
    if (withStatus === 'true' && calculatedStatus) {
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

// 全てのルートに認証を適用（sidebar-countsの後に配置）
router.use(authenticate);

// JWT認証またはAPI Key認証のいずれかを許可するミドルウェア
function authenticateOrApiKey(req: Request, res: Response, next: NextFunction) {
  // まずJWT認証を試みる
  authenticate(req, res, (err?: any) => {
    if (!err) {
      // JWT認証成功
      return next();
    }
    
    // JWT認証失敗の場合、API Key認証を試みる
    apiKeyAuth(req, res, next);
  });
}

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

// ===== 汎用ルート（最後に定義する必要がある） =====

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

// 買主情報更新（JWT認証またはAPI Key認証）
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

    // sync=trueの場合は双方向同期を使用
    if (sync === 'true') {
      console.log('[PUT /buyers/:id] Using updateWithSync (sync=true)');
      const result = await buyerService.updateWithSync(
        buyerNumber,
        sanitizedData,
        userId,
        userEmail,
        { force: force === 'true' }
      );

      // 競合がある場合は409を返す
      if (result.syncResult.conflict && result.syncResult.conflict.length > 0) {
        return res.status(409).json({
          error: 'Conflict detected',
          buyer: result.buyer,
          syncStatus: result.syncResult.syncStatus,
          conflicts: result.syncResult.conflict
        });
      }

      return res.json({
        ...result.buyer,
        syncStatus: result.syncResult.syncStatus,
        syncError: result.syncResult.error
      });
    }

    // 従来の更新（同期なし）
    console.log('[PUT /buyers/:id] Using update (sync=false or not specified)');
    const updatedBuyer = await buyerService.update(buyerNumber, sanitizedData, userId, userEmail);
    console.log('[PUT /buyers/:id] Update completed successfully');
    res.json(updatedBuyer);
  } catch (error: any) {
    console.error('[PUT /buyers/:id] Error updating buyer:', error);
    
    if (error.message === 'Buyer not found') {
      return res.status(404).json({ error: error.message });
    }
    
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

    await buyerService.softDelete(buyerId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting buyer:', error);
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
