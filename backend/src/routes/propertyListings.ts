// 物件リストのAPIルート
import { Router, Request, Response } from 'express';
import { PropertyListingService } from '../services/PropertyListingService';
import { BuyerLinkageService } from '../services/BuyerLinkageService';
import { BuyerLinkageCache } from '../services/BuyerLinkageCache';
import { BuyerDistributionService } from '../services/BuyerDistributionService';
import { EnhancedBuyerDistributionService } from '../services/EnhancedBuyerDistributionService';
import { DataIntegrityDiagnosticService } from '../services/DataIntegrityDiagnosticService';
import { BuyerCandidateService } from '../services/BuyerCandidateService';
import { UrlValidator } from '../utils/urlValidator';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '../services/EmailService.supabase';
import { authenticate } from '../middleware/auth';


/**
 * 買付情報保存時に Google Chat へ通知を送信するヘルパー関数
 * 失敗しても保存結果には影響しない（例外を外部に伝播させない）
 */
async function notifyGoogleChatOfferSaved(
  propertyNumber: string,
  offerData: {
    offer_date?: string | null;
    offer_status?: string | null;
    offer_comment?: string | null;
    offer_amount?: string | null;
    address?: string | null;
    display_address?: string | null;
    property_type?: string | null;
    sales_assignee?: string | null;
  }
): Promise<void> {
  // Google Chat Webhook URL
  const WEBHOOK_URL =
    'https://chat.googleapis.com/v1/spaces/AAAA6iEDkiU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=azlyf21pENCpLLUdJPjnRNXOzsIAP550xebOMVxYRMQ';

  // 通知メッセージを組み立てる
  const message =
    `【買付情報更新】\n` +
    `物件番号: ${propertyNumber}\n` +
    `所在地: ${offerData.address ?? '未設定'}\n` +
    `住居表示: ${offerData.display_address ?? '未設定'}\n` +
    `種別: ${offerData.property_type ?? '未設定'}\n` +
    `物件担当: ${offerData.sales_assignee ?? '未設定'}\n` +
    `買付日: ${offerData.offer_date ?? '未設定'}\n` +
    `状況: ${offerData.offer_status ?? '未設定'}\n` +
    `買付コメント: ${offerData.offer_comment ?? '未設定'}`;

  try {
    // axios を使って Google Chat Webhook に POST する
    const axios = require('axios');
    await axios.post(WEBHOOK_URL, { text: message });
  } catch (err) {
    // 通知失敗はログ記録のみ（保存結果には影響しない）
    console.error('[notifyGoogleChatOfferSaved] Google Chat 通知の送信に失敗しました:', err);
  }
}

const router = Router();

// Supabaseクライアントを初期化
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// multer: multipart/form-data (添付ファイル) 対応
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const propertyListingService = new PropertyListingService();
const buyerLinkageService = new BuyerLinkageService();
const buyerLinkageCache = new BuyerLinkageCache();
const buyerDistributionService = new BuyerDistributionService();
const enhancedBuyerDistributionService = new EnhancedBuyerDistributionService();
const diagnosticService = new DataIntegrityDiagnosticService();
const buyerCandidateService = new BuyerCandidateService();
const emailService = new EmailService();

// 一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      limit = '50',
      offset = '0',
      orderBy = 'created_at',
      orderDirection = 'desc',
      search,
      status,
      salesAssignee,
      propertyType,
    } = req.query;

    const result = await propertyListingService.getAll({
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      orderBy: orderBy as string,
      orderDirection: orderDirection as 'asc' | 'desc',
      search: search as string,
      status: status as string,
      salesAssignee: salesAssignee as string,
      propertyType: propertyType as string,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching property listings:', error);
    res.status(500).json({ error: error.message });
  }
});

// 統計取得
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await propertyListingService.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// seller_phone バックフィル: property_listings の seller_phone を sellers テーブルから一括補完
router.get('/backfill-seller-phone', async (req: Request, res: Response) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { decrypt } = await import('../utils/encryption');

    const { data: listings, error: listErr } = await supabase
      .from('property_listings')
      .select('property_number')
      .is('seller_phone', null);

    if (listErr) throw new Error(listErr.message);
    if (!listings || listings.length === 0) {
      return res.json({ updated: 0, message: 'seller_phone が NULL の物件はありません' });
    }

    const propertyNumbers = listings.map((l: any) => l.property_number).filter(Boolean);

    const { data: sellers, error: sellerErr } = await supabase
      .from('sellers')
      .select('seller_number, phone_number')
      .in('seller_number', propertyNumbers);

    if (sellerErr) throw new Error(sellerErr.message);

    const phoneMap: Record<string, string> = {};
    for (const s of sellers || []) {
      if (s.phone_number) {
        try { phoneMap[s.seller_number] = decrypt(s.phone_number); } catch { /* skip */ }
      }
    }

    let updated = 0;
    for (const listing of listings) {
      const phone = phoneMap[listing.property_number];
      if (!phone) continue;
      const { error: upErr } = await supabase
        .from('property_listings')
        .update({ seller_phone: phone })
        .eq('property_number', listing.property_number);
      if (!upErr) updated++;
    }

    res.json({ updated, total: listings.length, message: `${updated}件の seller_phone を更新しました` });
  } catch (error: any) {
    console.error('[backfill-seller-phone] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 公開物件一覧取得（公開物件サイト用）
router.get('/public', async (req: Request, res: Response) => {
  try {
    const {
      limit = '20',
      offset = '0',
      propertyType,
      priceMin,
      priceMax,
      areas,
      location,
      propertyNumber,
      buildingAgeMin,
      buildingAgeMax,
    } = req.query;

    // propertyTypeが配列の場合とカンマ区切りの文字列の場合に対応
    let propertyTypeArray: string[] | undefined;
    if (propertyType) {
      if (Array.isArray(propertyType)) {
        propertyTypeArray = propertyType as string[];
      } else if (typeof propertyType === 'string') {
        propertyTypeArray = propertyType.split(',').map(t => t.trim());
      }
    }

    // areasが配列の場合とカンマ区切りの文字列の場合に対応
    let areasArray: string[] | undefined;
    if (areas) {
      if (Array.isArray(areas)) {
        areasArray = areas as string[];
      } else if (typeof areas === 'string') {
        areasArray = areas.split(',').map(a => a.trim());
      }
    }

    const result = await propertyListingService.getPublicProperties({
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      propertyType: propertyTypeArray,
      priceRange: {
        min: priceMin ? parseInt(priceMin as string, 10) : undefined,
        max: priceMax ? parseInt(priceMax as string, 10) : undefined,
      },
      areas: areasArray,
      location: location as string,
      propertyNumber: propertyNumber as string,
      buildingAgeRange: {
        min: buildingAgeMin ? parseInt(buildingAgeMin as string, 10) : undefined,
        max: buildingAgeMax ? parseInt(buildingAgeMax as string, 10) : undefined,
      },
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching public properties:', error);
    res.status(500).json({ error: error.message });
  }
});

// 個別取得
router.get('/:propertyNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const data = await propertyListingService.getByPropertyNumber(propertyNumber);
    
    if (!data) {
      res.status(404).json({ error: 'Property listing not found' });
      return;
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching property listing:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新
router.put('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const updates = req.body;

    const { notify_offer, ...updatesWithoutFlag } = updates;
    const safeUpdates = updatesWithoutFlag;

    // Validate distribution_areas if provided
    if (safeUpdates.distribution_areas !== undefined && safeUpdates.distribution_areas !== null) {
      const { PropertyDistributionAreaCalculator } = await import('../services/PropertyDistributionAreaCalculator');
      const calculator = new PropertyDistributionAreaCalculator();
      
      if (!calculator.validateAreaNumbers(safeUpdates.distribution_areas)) {
        return res.status(400).json({ 
          error: 'Invalid distribution_areas format. Must contain only valid area numbers (①-⑯, ㊵, ㊶)' 
        });
      }
    }

    // 買付フィールドの空文字列を null に変換する（空欄保存時の500エラー防止）
    const OFFER_FIELDS = ['offer_date', 'offer_status', 'offer_amount', 'offer_comment'] as const;
    for (const field of OFFER_FIELDS) {
      if (safeUpdates[field] === '') {
        safeUpdates[field] = null;
      }
    }

    // price_reduction_scheduled_date の空文字列を null に変換する（date型カラムへの空文字列保存エラー防止）
    if (safeUpdates.price_reduction_scheduled_date === '') {
      safeUpdates.price_reduction_scheduled_date = null;
    }

    // OFFER_FIELDSのいずれかが更新される場合、offer_status_updated_atを記録
    const hasOfferUpdate = OFFER_FIELDS.some(f => safeUpdates[f] !== undefined);
    if (hasOfferUpdate) {
      safeUpdates.offer_status_updated_at = new Date().toISOString();
    }

    const data = await propertyListingService.update(propertyNumber, safeUpdates);

    // 買付セクションからの保存時のみ Google Chat に通知する（notify_offer フラグで判定）
    if (notify_offer === true) {
      notifyGoogleChatOfferSaved(propertyNumber, {
        offer_date: data?.offer_date ?? safeUpdates.offer_date,
        offer_status: data?.offer_status ?? safeUpdates.offer_status,
        offer_comment: data?.offer_comment ?? safeUpdates.offer_comment,
        offer_amount: data?.offer_amount ?? safeUpdates.offer_amount,
        address: data?.address,
        display_address: data?.display_address,
        property_type: data?.property_type,
        sales_assignee: data?.sales_assignee,
      });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error updating property listing:', error);
    res.status(500).json({ error: error.message });
  }
});

// スプレッドシート同期デバッグ（ヘッダー確認）
router.get('/debug/spreadsheet-headers', async (req: Request, res: Response) => {
  try {
    const headers = await (propertyListingService as any).sheetsClient?.authenticate()
      .then(() => (propertyListingService as any).sheetsClient?.getHeaders());
    res.json({
      sheetsClientInitialized: !!(propertyListingService as any).sheetsClient,
      spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID,
      sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
      headers: headers || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// スプレッドシート同期デバッグ（物件番号で行検索）
router.get('/debug/find-row/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const sheetsClient = (propertyListingService as any).sheetsClient;
    if (!sheetsClient) {
      res.json({ error: 'sheetsClient not initialized' });
      return;
    }
    await sheetsClient.authenticate();
    const rowIndex = await sheetsClient.findRowByColumn('物件番号', propertyNumber);
    
    // dbToSpreadsheetマッピングも確認
    const columnMapper = (propertyListingService as any).columnMapper;
    const dbToSpreadsheet = (columnMapper as any).dbToSpreadsheet;
    
    res.json({
      propertyNumber,
      rowIndex,
      found: rowIndex !== null,
      sampleMappings: {
        special_notes: dbToSpreadsheet['special_notes'],
        status: dbToSpreadsheet['status'],
        atbb_status: dbToSpreadsheet['atbb_status'],
        price: dbToSpreadsheet['price'],
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 複数物件の買主カウント取得
router.get('/buyer-counts/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumbers } = req.query;

    if (!propertyNumbers || typeof propertyNumbers !== 'string') {
      res.status(400).json({ error: 'propertyNumbers query parameter is required' });
      return;
    }

    const propNumArray = propertyNumbers.split(',').map(n => n.trim()).filter(n => n);

    if (propNumArray.length === 0) {
      res.json({});
      return;
    }

    // キャッシュチェック
    const counts: Record<string, number> = {};
    const uncachedNumbers: string[] = [];

    for (const propNum of propNumArray) {
      const cached = await buyerLinkageCache.getBuyerCount(propNum);
      if (cached !== null) {
        counts[propNum] = cached;
      } else {
        uncachedNumbers.push(propNum);
      }
    }

    // 未キャッシュのものを取得
    if (uncachedNumbers.length > 0) {
      const fetchedCounts = await buyerLinkageService.getBuyerCountsForProperties(uncachedNumbers);
      
      for (const [propNum, count] of fetchedCounts.entries()) {
        counts[propNum] = count;
        await buyerLinkageCache.setBuyerCount(propNum, count);
      }
    }

    res.json(counts);
  } catch (error: any) {
    console.error('Error fetching buyer counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// 特定物件の買主リスト取得
router.get('/:propertyNumber/buyers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { sortBy, sortOrder, limit } = req.query;

    // キャッシュチェック
    const cached = await buyerLinkageCache.getBuyerList(propertyNumber);
    if (cached) {
      res.json(cached);
      return;
    }

    const buyers = await buyerLinkageService.getBuyersForProperty(propertyNumber, {
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });

    // キャッシュに保存
    await buyerLinkageCache.setBuyerList(propertyNumber, buyers);

    res.json(buyers);
  } catch (error: any) {
    console.error('Error fetching buyers for property:', error);
    res.status(500).json({ error: error.message });
  }
});

// 買主リストキャッシュを手動クリア
router.delete('/:propertyNumber/buyers/cache', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    await buyerLinkageCache.invalidate(propertyNumber);
    console.log(`[cache-clear] Buyer list cache cleared for property: ${propertyNumber}`);
    res.json({ success: true, message: `Cache cleared for ${propertyNumber}` });
  } catch (error: any) {
    console.error('Error clearing buyer list cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// 買主候補リスト取得（条件に合致する買主を抽出）
router.get('/:propertyNumber/buyer-candidates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { propertyType } = req.query;

    console.log(`[buyer-candidates] Fetching candidates for property: ${propertyNumber}${propertyType ? ` (propertyType override: ${propertyType})` : ''}`);

    const result = await buyerCandidateService.getCandidatesForProperty(
      propertyNumber,
      typeof propertyType === 'string' ? propertyType : undefined
    );

    console.log(`[buyer-candidates] Found ${result.total} candidates for property: ${propertyNumber}`);

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching buyer candidates:', error);

    if (error.message === 'Property not found') {
      res.status(404).json({
        error: 'Property not found',
        code: 'PROPERTY_NOT_FOUND'
      });
      return;
    }

    res.status(500).json({
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 高確度買主を持つ物件リスト取得
router.get('/high-confidence-buyers/list', async (_req: Request, res: Response) => {
  try {
    const propertyNumbers = await buyerLinkageService.getPropertiesWithHighConfidenceBuyers();
    res.json(propertyNumbers);
  } catch (error: any) {
    console.error('Error fetching high confidence properties:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gmail配信用の買主メールアドレス取得
router.get('/:propertyNumber/distribution-buyers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { includeRadius = 'true' } = req.query;

    const result = await buyerDistributionService.getQualifiedBuyers({
      propertyNumber,
      includeRadiusFilter: includeRadius === 'true'
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching distribution buyers:', error);
    
    if (error.message.includes('Property not found')) {
      res.status(404).json({ 
        error: 'Property not found',
        code: 'PROPERTY_NOT_FOUND'
      });
      return;
    }

    res.status(500).json({ 
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// Gmail配信用の買主メールアドレス取得（拡張版 - 複数条件フィルタリング）
router.get('/:propertyNumber/distribution-buyers-enhanced', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { propertyNumber } = req.params;
    const { includeDetails = 'false' } = req.query;

    console.log(`[${requestId}] Request received: GET /api/property-listings/${propertyNumber}/distribution-buyers-enhanced`, {
      includeDetails,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent']
    });

    // パラメータバリデーション
    if (!propertyNumber || typeof propertyNumber !== 'string' || propertyNumber.trim() === '') {
      console.warn(`[${requestId}] Invalid property number parameter: ${propertyNumber}`);
      res.status(400).json({ 
        error: 'Invalid property number',
        code: 'INVALID_PARAMETER',
        message: 'Property number must be a non-empty string'
      });
      return;
    }

    // includeDetailsパラメータのバリデーション
    if (includeDetails && typeof includeDetails !== 'string') {
      console.warn(`[${requestId}] Invalid includeDetails parameter: ${includeDetails}`);
      res.status(400).json({ 
        error: 'Invalid includeDetails parameter',
        code: 'INVALID_PARAMETER',
        message: 'includeDetails must be "true" or "false"'
      });
      return;
    }

    console.log(`[${requestId}] Fetching enhanced distribution buyers for property: ${propertyNumber}`);

    // 拡張フィルタリングサービスを使用
    const result = await enhancedBuyerDistributionService.getQualifiedBuyersWithAllCriteria({
      propertyNumber
    });

    const duration = Date.now() - startTime;

    // includeDetailsがfalseの場合、詳細情報を除外
    if (includeDetails !== 'true') {
      const { filteredBuyers, ...rest } = result;
      console.log(`[${requestId}] Success: Returning ${rest.emails.length} qualified buyer emails (without details)`, {
        duration: `${duration}ms`,
        totalBuyers: rest.totalBuyers,
        qualifiedCount: rest.count
      });
      res.json(rest);
      return;
    }

    console.log(`[${requestId}] Success: Returning ${result.emails.length} qualified buyer emails (with details)`, {
      duration: `${duration}ms`,
      totalBuyers: result.totalBuyers,
      qualifiedCount: result.count
    });
    res.json(result);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Error fetching enhanced distribution buyers:`, {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      propertyNumber: req.params.propertyNumber
    });
    
    // エラータイプに応じた適切なレスポンス
    if (error.code === 'PROPERTY_NOT_FOUND' || error.message.includes('Property not found') || error.message.includes('not found')) {
      console.warn(`[${requestId}] Property not found: ${req.params.propertyNumber}`);
      
      // Run diagnostics to provide helpful information
      try {
        const diagnostic = await diagnosticService.diagnoseProperty(req.params.propertyNumber);
        
        console.log(`[${requestId}] Diagnostic result:`, {
          propertyNumber: req.params.propertyNumber,
          existsInSellers: diagnostic.existsInSellers,
          existsInPropertyListings: diagnostic.existsInPropertyListings,
          syncStatus: diagnostic.syncStatus
        });
        
        res.status(404).json({ 
          error: 'Property not found',
          code: 'PROPERTY_NOT_FOUND',
          message: `Property with number ${req.params.propertyNumber} does not exist in property_listings`,
          propertyNumber: req.params.propertyNumber,
          diagnostics: {
            existsInSellers: diagnostic.existsInSellers,
            canBeRecovered: diagnostic.existsInSellers && !diagnostic.existsInPropertyListings,
            syncStatus: diagnostic.syncStatus
          }
        });
      } catch (diagError: any) {
        console.error(`[${requestId}] Failed to run diagnostics:`, diagError);
        res.status(404).json({ 
          error: 'Property not found',
          code: 'PROPERTY_NOT_FOUND',
          message: `Property with number ${req.params.propertyNumber} does not exist`,
          propertyNumber: req.params.propertyNumber
        });
      }
      return;
    }

    if (error.message.includes('Invalid') || error.message.includes('validation')) {
      console.warn(`[${requestId}] Validation error: ${error.message}`);
      res.status(400).json({ 
        error: 'Invalid request parameters',
        code: 'INVALID_PARAMETER',
        message: error.message
      });
      return;
    }

    // データベース接続エラー
    if (error.message.includes('database') || error.message.includes('connection')) {
      console.error(`[${requestId}] Database error: ${error.message}`);
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection error. Please try again later.'
      });
      return;
    }

    // その他のサーバーエラー
    console.error(`[${requestId}] Internal server error: ${error.message}`, error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 物件配信メールを一括送信
 */
router.post('/:propertyNumber/send-distribution-emails', authenticate, async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { recipientEmails, recipients, subject, content, htmlBody, from, attachments, assigneeEmail } = req.body;

    // デバッグログ: リクエストボディを記録
    console.log(`[send-distribution-emails] Request body:`, JSON.stringify({
      propertyNumber,
      recipientEmails: recipientEmails?.length,
      recipients: recipients?.length,
      recipientsDetail: recipients,
      subject,
      from
    }));

    // recipients フィールドを優先、なければ recipientEmails を使用（後方互換性）
    const normalizedRecipients: Array<{ email: string; buyerNumber?: string }> = recipients || recipientEmails?.map((email: string) => ({ email })) || [];

    console.log(`[send-distribution-emails] Normalized recipients:`, normalizedRecipients);

    // バリデーション
    if (!normalizedRecipients || normalizedRecipients.length === 0) {
      return res.status(400).json({
        error: 'recipients or recipientEmails is required and must be a non-empty array'
      });
    }

    if (!subject || !content) {
      return res.status(400).json({
        error: 'subject and content are required'
      });
    }

    if (!from) {
      return res.status(400).json({
        error: 'from (sender address) is required'
      });
    }

    // 物件情報を取得
    const property = await propertyListingService.getByPropertyNumber(propertyNumber);
    if (!property) {
      return res.status(404).json({
        error: 'Property listing not found'
      });
    }

    // 売主名のフォールバックロジック: seller_nameが空または"様"のみの場合はowner_infoを使用
    const resolveSellerName = (sellerName: string | null | undefined, ownerInfo: string | null | undefined): string | null => {
      const trimmed = (sellerName || '').trim();
      const isBlankOrSamaOnly = !trimmed || trimmed === '様';
      return isBlankOrSamaOnly ? (ownerInfo || null) : trimmed;
    };
    const effectiveSellerName = resolveSellerName(property.seller_name, property.owner_info);
    console.log(`[send-distribution-emails] Seller name resolved: "${property.seller_name}" → "${effectiveSellerName}" (owner_info: "${property.owner_info}")`);

    // 買主番号から買主名を取得するマップを作成
    const buyerNameMap: Record<string, string> = {};
    const buyerNumbersToFetch = normalizedRecipients
      .map(r => typeof r === 'string' ? undefined : r.buyerNumber)
      .filter((bn): bn is string => !!bn);
    
    if (buyerNumbersToFetch.length > 0) {
      try {
        const { BuyerService } = await import('../services/BuyerService');
        const buyerService = new BuyerService();
        
        for (const buyerNumber of buyerNumbersToFetch) {
          try {
            const buyer = await buyerService.getByBuyerNumber(buyerNumber);
            if (buyer && buyer.name) {
              buyerNameMap[buyerNumber] = buyer.name;
            }
          } catch (err) {
            console.warn(`Failed to fetch buyer name for ${buyerNumber}:`, err);
          }
        }
      } catch (err) {
        console.error('Failed to import BuyerService:', err);
      }
    }

    // 各受信者にメールを送信
    const results = await Promise.allSettled(
      normalizedRecipients.map(async (recipient) => {
        const email = typeof recipient === 'string' ? recipient : recipient.email;
        const buyerNumber = typeof recipient === 'string' ? undefined : recipient.buyerNumber;
        
        // 買主名を取得（買主番号がある場合）、なければ「お客様」
        const buyerName = buyerNumber && buyerNameMap[buyerNumber] ? buyerNameMap[buyerNumber] : 'お客様';
        
        // {buyerName}プレースホルダーを実際の買主名に置換
        const personalizedSubject = subject.replace(/\{buyerName\}/g, buyerName);
        const personalizedContent = content.replace(/\{buyerName\}/g, buyerName);

        // 添付ファイルがある場合は各ソースに応じてデータを取得して添付付きで送信
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {

          // URL指定の画像（公開プロキシURL）は<img>タグとしてHTMLに直接埋め込む
          // 「他社物件新着配信」と同じ方式
          const urlImages = attachments.filter((img: any) => img.url);
          const fileImages = attachments.filter((img: any) => !img.url);

          // URL画像を<img>タグに変換
          const urlImgTags = urlImages
            .map((img: any) => `<img src="${img.url}" alt="${img.name || '物件画像'}" style="max-width:600px;width:100%;height:auto;display:block;margin:8px 0;" />`)
            .join('\n');

          // content（プレーンテキスト）から公開URLを抽出して<a>タグを生成
          const publicUrlMatch = (content || '').match(/https:\/\/property-site-frontend-kappa\.vercel\.app\/public\/properties\/[^\s]+/);
          const extractedPublicUrl = publicUrlMatch ? publicUrlMatch[0] : '';
          const publicUrlAnchor = extractedPublicUrl
            ? `<a href="${extractedPublicUrl}" style="color:#1a73e8;font-weight:bold;">こちら</a>`
            : 'こちら';

          // {propertyImages}と{publicUrlLink}を置換
          const rawHtmlBody = htmlBody ? htmlBody.replace(/\{buyerName\}/g, buyerName) : undefined;
          const tateuriUrl = 'https://sateituikyaku-admin-frontend.vercel.app/tateuri';
          const tateuriAnchor = `<a href="${tateuriUrl}" style="color:#1a73e8;font-weight:bold;">${tateuriUrl}</a>`;
          const personalizedHtmlBody = rawHtmlBody
            ? rawHtmlBody
                .replace(/\{propertyImages\}/g, urlImgTags)
                .replace(/\{publicUrlLink\}/g, publicUrlAnchor)
                .replace(new RegExp(tateuriUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tateuriAnchor)
            : undefined;
          const cleanContent = personalizedContent
            .replace(/\{propertyImages\}/g, '')
            .replace(/\{publicUrlLink\}/g, 'こちら');

          // ファイル添付（DriveファイルやBase64）がある場合のみ添付処理
          if (fileImages.length > 0) {
            const { GoogleDriveService } = await import('../services/GoogleDriveService');
            const driveService = new GoogleDriveService();

            const emailAttachmentsRaw = await Promise.all(
              fileImages.map(async (img: any) => {
                if (img.base64Data) {
                  return {
                    filename: img.name || 'attachment.jpg',
                    mimeType: img.mimeType || 'image/jpeg',
                    data: Buffer.from(img.base64Data, 'base64'),
                    cid: `attachment-${img.id}`,
                  };
                }
                const fileId = img.driveFileId || img.id;
                const fileData = await driveService.getFile(fileId);
                if (!fileData) {
                  console.warn(`⚠️ Could not fetch file from Google Drive: ${fileId}`);
                  return null;
                }
                return {
                  filename: img.name || `image-${fileId}.jpg`,
                  mimeType: fileData.mimeType || 'image/jpeg',
                  data: fileData.data,
                  cid: `attachment-${img.id}`,
                };
              })
            );
            const emailAttachments = emailAttachmentsRaw.filter((a): a is NonNullable<typeof a> => a !== null);

            return await emailService.sendEmailWithCcAndAttachments({
              to: email,
              subject: personalizedSubject,
              body: personalizedHtmlBody || cleanContent,
              from,
              attachments: emailAttachments,
              isHtml: !!htmlBody,
            });
          }

          // URL画像のみ（添付なし）: HTMLに埋め込み済みなので添付なしで送信
          return await emailService.sendEmailWithCcAndAttachments({
            to: email,
            subject: personalizedSubject,
            body: personalizedHtmlBody || cleanContent,
            from,
            attachments: [],
            isHtml: !!htmlBody,
          });
        }

        // 添付ファイルなし: 既存フロー（変更なし）
        // ダミーのseller objectを作成（EmailServiceのインターフェースに合わせる）
        const dummySeller = {
          id: property.id,
          seller_number: propertyNumber,
          name: buyerName,
          email: email,
          phone_number: '',
          property_address: property.property_address || '',
          created_at: new Date(),
          updated_at: new Date()
        };

        const tateuriUrlNoAttach = 'https://sateituikyaku-admin-frontend.vercel.app/tateuri';
        const tateuriAnchorNoAttach = `<a href="${tateuriUrlNoAttach}" style="color:#1a73e8;font-weight:bold;">${tateuriUrlNoAttach}</a>`;
        const htmlBodyNoAttach = htmlBody
          ? htmlBody
              .replace(/\{buyerName\}/g, buyerName)
              .replace(/\{propertyImages\}/g, '')
              .replace(/\{publicUrlLink\}/g, 'こちら')
              .replace(new RegExp(tateuriUrlNoAttach.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), tateuriAnchorNoAttach)
          : undefined;

        return await emailService.sendTemplateEmail(
          dummySeller as any,
          personalizedSubject,
          personalizedContent.replace(/\{propertyImages\}/g, '').replace(/\{publicUrlLink\}/g, 'こちら'),
          from,
          req.employee?.id || 'system',
          htmlBodyNoAttach,
          from
        );
      })
    );

    // 成功・失敗をカウント
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - successCount;

    // 失敗したメールのエラーメッセージを収集
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error')
      .join(', ');

    const failedResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && !r.value.success)
      .map(r => r.value.error || 'Unknown error')
      .join(', ');

    const allErrors = [errors, failedResults].filter(e => e).join(', ');

    // property_chat_history に送信履歴を保存（1件以上成功した場合）
    // フロントエンド側のonSendSuccessコールバックに依存せず、バックエンド側でも確実に記録する
    if (successCount > 0) {
      try {
        const { error: chatHistoryError } = await supabase
          .from('property_chat_history')
          .insert({
            property_number: propertyNumber,
            chat_type: 'seller_gmail',
            subject: subject || '',
            message: content || '',
            sender_name: req.employee?.name || req.employee?.initials || 'system',
            sent_at: new Date().toISOString(),
          });

        if (chatHistoryError) {
          console.error('[send-distribution-emails] property_chat_history insert error:', chatHistoryError);
        } else {
          console.log(`[send-distribution-emails] property_chat_history saved for ${propertyNumber}`);
        }
      } catch (chatHistoryErr) {
        console.error('[send-distribution-emails] Failed to save property_chat_history:', chatHistoryErr);
      }
    }

    // activity_logsに記録（メール送信成功後）
    // 各買主ごとに記録
    const { ActivityLogService } = await import('../services/ActivityLogService');
    const activityLogService = new ActivityLogService();
    
    // 物件住所を取得
    const propertyAddresses: Record<string, string> = {};
    if (property.property_address) {
      propertyAddresses[propertyNumber] = property.property_address;
    }
    
    console.log(`[send-distribution-emails] Recording activity logs for ${normalizedRecipients.length} recipients with source: pre_public_price_reduction`);
    console.log(`[send-distribution-emails] Employee ID: ${req.employee?.id || 'unknown'}`);
    console.log(`[send-distribution-emails] Property addresses:`, propertyAddresses);
    
    for (let i = 0; i < normalizedRecipients.length; i++) {
      const recipient = normalizedRecipients[i];
      const result = results[i];
      
      // メール送信が成功した場合のみ記録
      if (result.status === 'fulfilled' && result.value.success) {
        try {
          const email = typeof recipient === 'string' ? recipient : recipient.email;
          const buyerNumber = typeof recipient === 'string' ? undefined : recipient.buyerNumber;
          
          // 買主名を取得（買主番号がある場合）、なければ「お客様」
          const buyerName = buyerNumber && buyerNameMap[buyerNumber] ? buyerNameMap[buyerNumber] : 'お客様';
          
          // {buyerName}プレースホルダーを実際の買主名に置換した本文を記録
          const personalizedSubject = subject.replace(/\{buyerName\}/g, buyerName);
          const personalizedContent = content.replace(/\{buyerName\}/g, buyerName);
          
          // 買主番号がカンマ区切りの場合、分割して各買主番号ごとに記録
          const buyerNumbers = buyerNumber ? buyerNumber.split(',').map((n: string) => n.trim()) : [];
          
          if (buyerNumbers.length > 0) {
            // 複数の買主番号がある場合、各買主番号ごとに記録
            for (const singleBuyerNumber of buyerNumbers) {
              console.log(`[send-distribution-emails] Logging email for buyer: ${singleBuyerNumber}`);
              await activityLogService.logEmail({
                buyerId: singleBuyerNumber,
                propertyNumbers: [propertyNumber],
                propertyAddresses: propertyAddresses,
                recipientEmail: email,
                subject: personalizedSubject,
                templateName: '公開前・値下げメール',
                senderEmail: from,
                source: 'pre_public_price_reduction', // 送信元識別子
                body: personalizedContent, // 個別化されたメール本文を記録
                createdBy: req.employee?.id || 'system',
              });
              console.log(`[send-distribution-emails] Successfully logged email for buyer: ${singleBuyerNumber}`);
            }
          } else {
            // 買主番号がない場合、メールアドレスで記録
            console.log(`[send-distribution-emails] Logging email for email: ${email}`);
            await activityLogService.logEmail({
              buyerId: email,
              propertyNumbers: [propertyNumber],
              propertyAddresses: propertyAddresses,
              recipientEmail: email,
              subject: personalizedSubject,
              templateName: '公開前・値下げメール',
              senderEmail: from,
              source: 'pre_public_price_reduction', // 送信元識別子
              body: personalizedContent, // 個別化されたメール本文を記録
              createdBy: req.employee?.id || 'system',
            });
            console.log(`[send-distribution-emails] Successfully logged email for email: ${email}`);
          }
        } catch (logError) {
          // activity_logs記録失敗はログのみ（ユーザーには通知しない）
          console.error(`[send-distribution-emails] Failed to log email activity for ${typeof recipient === 'string' ? recipient : recipient.buyerNumber || recipient.email}:`, logError);
        }
      }
    }

    // 担当者への通知メールを1通送信（assigneeEmailが指定されている場合のみ）
    if (assigneeEmail && successCount > 0) {
      try {
        console.log(`[send-distribution-emails] Sending notification to assignee: ${assigneeEmail}`);
        const assigneeSubject = `【配信済み】${subject}`;
        const assigneeBody = `${successCount}件の買主様にメールを配信しました。\n\n` +
          `物件番号: ${propertyNumber}\n` +
          `物件住所: ${property.property_address || ''}\n` +
          `件名: ${subject}\n\n` +
          `---\n` +
          `${content}`;
        const assigneeHtmlBody = assigneeBody.replace(/\n/g, '<br>');

        await emailService.sendEmailWithCcAndAttachments({
          to: assigneeEmail,
          subject: assigneeSubject,
          body: assigneeHtmlBody,
          from,
          isHtml: true,
        });
        console.log(`[send-distribution-emails] Assignee notification sent to: ${assigneeEmail}`);
      } catch (assigneeError) {
        // 担当者への送信失敗はログのみ（買主への送信結果には影響しない）
        console.error(`[send-distribution-emails] Failed to send assignee notification:`, assigneeError);
      }
    }

    res.json({
      success: failedCount === 0,
      successCount,
      failedCount,
      totalCount: normalizedRecipients.length,
      error: failedCount > 0 ? allErrors : undefined
    });
  } catch (error: any) {
    console.error('Error sending distribution emails:', error);
    res.status(500).json({
      error: error.message || 'Failed to send distribution emails',
      success: false,
      successCount: 0,
      failedCount: req.body.recipientEmails?.length || req.body.recipients?.length || 0
    });
  }
});



// 非表示画像リストを取得
router.get('/:id/hidden-images', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const hiddenImages = await propertyListingService.getHiddenImages(id);

    res.json({
      hiddenImages,
      count: hiddenImages.length
    });
  } catch (error: any) {
    console.error('Error fetching hidden images:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 画像一覧を取得（非表示画像を除外）
router.get('/:id/images', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const images = await propertyListingService.getVisibleImages(id);

    res.json({
      images,
      count: images.length
    });
  } catch (error: any) {
    console.error('Error fetching images:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 画像を非表示にする
router.post('/:id/hide-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      res.status(400).json({ 
        error: 'fileId is required',
        code: 'MISSING_FILE_ID'
      });
      return;
    }

    await propertyListingService.hideImage(id, fileId);

    res.json({
      success: true,
      message: `Image ${fileId} has been hidden`
    });
  } catch (error: any) {
    console.error('Error hiding image:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 画像を復元する（非表示を解除）
router.post('/:id/unhide-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      res.status(400).json({ 
        error: 'fileId is required',
        code: 'MISSING_FILE_ID'
      });
      return;
    }

    await propertyListingService.unhideImage(id, fileId);

    res.json({
      success: true,
      message: `Image ${fileId} has been unhidden`
    });
  } catch (error: any) {
    console.error('Error unhiding image:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

// 配信エリア番号を計算
router.post('/:propertyNumber/calculate-distribution-areas', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;

    // 物件データを取得
    const property = await propertyListingService.getByPropertyNumber(propertyNumber);
    if (!property) {
      res.status(404).json({ success: false, message: '物件が見つかりません' });
      return;
    }

    const googleMapUrl = property.google_map_url;
    if (!googleMapUrl) {
      res.status(400).json({ success: false, message: 'GoogleマップURLが設定されていません' });
      return;
    }

    const { PropertyDistributionAreaCalculator } = await import('../services/PropertyDistributionAreaCalculator');
    const { CityNameExtractor } = await import('../services/CityNameExtractor');
    const calculator = new PropertyDistributionAreaCalculator();
    const cityExtractor = new CityNameExtractor();

    const address = property.address || null;
    const city = address ? cityExtractor.extractCityFromAddress(address) : null;

    // DBに座標がある場合はそれを優先使用（URLからの短縮URL展開を回避）
    const preloadedCoords = (property.latitude && property.longitude)
      ? { lat: Number(property.latitude), lng: Number(property.longitude) }
      : null;

    if (preloadedCoords) {
      console.log(`[DistributionArea] Using DB coordinates: ${preloadedCoords.lat}, ${preloadedCoords.lng}`);
    } else {
      console.log(`[DistributionArea] No DB coordinates, will try URL extraction`);
    }

    const result = await calculator.calculateDistributionAreas(
      googleMapUrl,
      city,
      address,
      preloadedCoords
    );

    // 計算結果をDBに自動保存
    if (result.formatted) {
      await propertyListingService.update(propertyNumber, {
        distribution_areas: result.formatted
      });
      console.log(`[DistributionArea] Auto-saved distribution_areas for ${propertyNumber}: ${result.formatted}`);
    }

    res.json({
      success: true,
      areas: result.formatted,
      areaList: result.areas,
      radiusAreas: result.radiusAreas,
      cityWideAreas: result.cityWideAreas,
    });
  } catch (error: any) {
    console.error('Error calculating distribution areas:', error);
    res.status(500).json({ success: false, message: error.message || '計算に失敗しました' });
  }
});

// Google Map URLを更新
router.patch('/:propertyNumber/google-map-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { googleMapUrl } = req.body;

    // Validate URL
    if (!UrlValidator.validateGoogleMapUrl(googleMapUrl)) {
      res.status(400).json({
        error: '有効なGoogle Map URLを入力してください'
      });
      return;
    }

    // Sanitize URL
    const sanitizedUrl = UrlValidator.sanitizeUrl(googleMapUrl);

    // Update property
    const updatedProperty = await propertyListingService.update(propertyNumber, {
      google_map_url: sanitizedUrl
    });

    res.json({
      success: true,
      distributionAreas: updatedProperty.distribution_areas
    });
  } catch (error: any) {
    console.error('Error updating Google Map URL:', error);
    res.status(500).json({ error: 'Failed to update Google Map URL' });
  }
});

// Storage Locationを更新
router.patch('/:propertyNumber/storage-location', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { storageLocation } = req.body;

    // Validate URL
    if (!UrlValidator.validateGoogleDriveFolderUrl(storageLocation)) {
      res.status(400).json({
        error: '有効なGoogle DriveフォルダURLを入力してください'
      });
      return;
    }

    // Sanitize URL
    const sanitizedUrl = UrlValidator.sanitizeUrl(storageLocation);

    // Update property
    await propertyListingService.update(propertyNumber, {
      storage_location: sanitizedUrl
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating Storage Location:', error);
    res.status(500).json({ error: 'Failed to update Storage Location' });
  }
});

// 報告書送信履歴を取得
router.get('/:propertyNumber/report-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .select('*')
      .eq('property_number', propertyNumber)
      .order('sent_at', { ascending: false })
      .limit(50);
    if (error) {
      // テーブルが存在しない場合は空配列を返す
      res.json([]);
      return;
    }
    res.json(data || []);
  } catch (error: any) {
    console.error('Error fetching report history:', error);
    res.json([]);
  }
});

// 報告書送信履歴を記録
router.post('/:propertyNumber/report-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { template_name, subject, body, report_date, report_assignee, report_completed } = req.body;
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('property_report_history')
      .insert({
        property_number: propertyNumber,
        template_name: template_name || null,
        subject: subject || null,
        body: body || null,
        report_date: report_date || null,
        report_assignee: report_assignee || null,
        report_completed: report_completed || 'N',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // テーブルが存在しない場合はエラーを無視
      res.json({ success: false, message: 'Table not found, skipping history record' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error recording report history:', error);
    res.json({ success: false });
  }
});

// 報告書メール送信（Gmail API で直接送信 + 送信履歴の記録）
// multipart/form-data 対応（添付ファイル・CC をサポート）
router.post('/:propertyNumber/send-report-email', authenticate, upload.array('attachments', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { to, cc, subject, body, template_name, report_date, report_assignee, report_completed, from, replyTo } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!to || !subject || !body) {
      res.status(400).json({ error: '宛先・件名・本文は必須です' });
      return;
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const senderAddress = 'tenant@ifoo-oita.com'; // 文字化け防止のため固定
    const employeeId = req.employee?.id || 'system';

    console.log('[send-report-email] Sending email:', {
      propertyNumber,
      to,
      cc: cc || '(none)',
      subject,
      senderAddress,
      employeeId,
      replyTo: replyTo || '(none)',
      attachmentCount: files?.length || 0,
      hasGmailRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      hasGoogleCalendarClientId: !!process.env.GOOGLE_CALENDAR_CLIENT_ID,
    });

    // 添付ファイルを EmailAttachment 形式に変換
    // multer は originalname を latin1 として扱うため、UTF-8 に変換する
    const attachments = (files || []).map((file) => ({
      filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      mimeType: file.mimetype,
      data: file.buffer,
      cid: `attachment-${Date.now()}-${file.originalname}`,
    }));

    // Gmail API で直接送信
    const dummySeller = {
      id: propertyNumber,
      seller_number: propertyNumber,
      name: '',
      email: to,
      phone_number: '',
      property_address: '',
      created_at: new Date(),
      updated_at: new Date(),
    };

    let result;
    if (attachments.length > 0 || cc) {
      // 添付ファイルまたはCCがある場合は sendEmailWithCcAndAttachments を使用
      result = await emailService.sendEmailWithCcAndAttachments({
        to,
        cc: cc || undefined,
        subject,
        body,
        from: senderAddress,
        attachments,
        // replyTo が指定されている場合は Reply-To ヘッダーを設定する
        replyTo: replyTo || undefined,
      });
    } else if (replyTo) {
      // 添付・CCなしでも replyTo が指定されている場合は sendEmailWithCcAndAttachments を使用
      // （sendTemplateEmail は Reply-To ヘッダーをサポートしていないため）
      result = await emailService.sendEmailWithCcAndAttachments({
        to,
        cc: undefined,
        subject,
        body,
        from: senderAddress,
        attachments: [],
        replyTo,
      });
    } else {
      result = await emailService.sendTemplateEmail(
        dummySeller as any,
        subject,
        body,
        senderAddress,
        employeeId,
        undefined,
        senderAddress
      );
    }

    console.log('[send-report-email] Result:', { success: result.success, error: result.error, messageId: result.messageId });

    if (!result.success) {
      const errorMsg = result.error || 'メール送信に失敗しました';
      if (errorMsg.includes('GOOGLE_AUTH_REQUIRED') || errorMsg.includes('認証') || errorMsg.includes('not configured')) {
        res.status(500).json({ 
          error: 'Gmail認証が必要です。管理者にGoogle連携の設定を依頼してください。',
          detail: errorMsg
        });
      } else {
        res.status(500).json({ error: errorMsg });
      }
      return;
    }

    // 送信履歴を記録
    await supabase.from('property_report_history').insert({
      property_number: propertyNumber,
      template_name: template_name || null,
      subject,
      body,
      report_date: report_date || null,
      report_assignee: report_assignee || null,
      report_completed: report_completed || 'N',
      sent_at: new Date().toISOString(),
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('[send-report-email] Unexpected error:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'メール送信に失敗しました' });
  }
});

// 売買契約完了 Google Chat通知
router.post('/:propertyNumber/notify-contract-completed', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { StaffManagementService } = require('../services/StaffManagementService');
    const axios = require('axios');

    const DEFAULT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';

    // 物件情報を取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    const message = `契約が完了しましたので、ネット非公開お願いします。${property.property_number}　${property.address || ''}よろしくお願いいたします`;

    // 担当者のWebhook URLを取得
    let webhookUrl = DEFAULT_WEBHOOK_URL;
    if (property.sales_assignee) {
      const staffService = new StaffManagementService();
      const result = await staffService.getWebhookUrl(property.sales_assignee);
      if (result.success && result.webhookUrl) {
        webhookUrl = result.webhookUrl;
        console.log(`[notify-contract-completed] Using assignee webhook for ${property.sales_assignee}`);
      } else {
        // Webhook URL取得失敗 → フォールバックURLを使用
        console.warn(`[notify-contract-completed] Failed to get webhook for ${property.sales_assignee}. Using fallback URL.`);
        // webhookUrl は DEFAULT_WEBHOOK_URL のまま
      }
    } else {
      console.log(`[notify-contract-completed] No sales_assignee set for ${propertyNumber}. Using fallback URL.`);
    }

    // Google Chatに送信
    await axios.post(webhookUrl, { text: message });

    console.log(`[notify-contract-completed] Sent to ${webhookUrl} for ${propertyNumber}`);
    res.json({ success: true, message });
  } catch (error: any) {
    console.error('[notify-contract-completed] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});


// 担当へCHAT送信
router.post('/:propertyNumber/send-chat-to-assignee', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { message, senderName } = req.body;

    if (!message || !String(message).trim()) {
      res.status(400).json({ error: 'メッセージを入力してください' });
      return;
    }

    const { StaffManagementService } = require('../services/StaffManagementService');
    const axios = require('axios');

    // 物件情報を取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee, seller_name, seller_contact, seller_email, owner_info')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    // 売主名のフォールバックロジック: seller_nameが空または"様"のみの場合はowner_infoを使用
    const resolveSellerName = (sellerName: string | null | undefined, ownerInfo: string | null | undefined): string | null => {
      const trimmed = (sellerName || '').trim();
      const isBlankOrSamaOnly = !trimmed || trimmed === '様';
      return isBlankOrSamaOnly ? (ownerInfo || null) : trimmed;
    };
    const effectiveSellerName = resolveSellerName(property.seller_name, property.owner_info);

    // 物件担当がいない場合は事務チャットへ送信
    if (!property.sales_assignee) {
      console.log(`[send-chat-to-assignee] No assignee for ${propertyNumber}, sending to office chat`);
      
      const officeWebhookUrl = 'https://chat.googleapis.com/v1/spaces/AAAAw9wyS-o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=t6SJmZ8af-yyB38DZzAqGOKYI-DnIl6wYtVo-Lyskuk';
      
      // 物件詳細画面のURL
      const propertyUrl = `https://sateituikyaku-admin-frontend.vercel.app/property-listings/${property.property_number}`;
      
      // 売主情報
      const sellerInfo = [
        effectiveSellerName ? `売主氏名: ${effectiveSellerName}` : null,
        property.seller_contact ? `売主電話: ${property.seller_contact}` : null,
        property.seller_email ? `売主メール: ${property.seller_email}` : null,
      ].filter(Boolean).join('\n');
      
      const senderLabel = senderName ? `送信者: ${senderName}` : null;
      
      const chatMessage = `📩 *物件担当への質問・伝言（担当未設定のため事務へ送信）*\n\n物件番号: ${property.property_number}\n所在地: ${property.address || '未設定'}\n担当: 未設定\n${sellerInfo ? sellerInfo + '\n' : ''}物件URL: ${propertyUrl}\n${senderLabel ? senderLabel + '\n' : ''}\n${String(message).trim()}`;
      
      await axios.post(officeWebhookUrl, { text: chatMessage });
      console.log(`[send-chat-to-assignee] Sent to office chat for ${propertyNumber}`);
      
      // CHAT送信履歴を保存
      try {
        await supabase
          .from('property_chat_history')
          .insert({
            property_number: propertyNumber,
            recipient_type: 'office',
            recipient_name: '事務',
            message: String(message).trim(),
            sender_label: senderLabel || null,
            sent_at: new Date().toISOString(),
          });
        console.log(`[send-chat-to-assignee] Chat history saved for ${propertyNumber}`);
      } catch (historyError: any) {
        console.error(`[send-chat-to-assignee] Failed to save chat history:`, historyError);
        // 履歴保存エラーでもレスポンスは成功を返す
      }
      
      res.json({ success: true });
      return;
    }

    // 担当者のWebhook URLを取得
    const staffService = new StaffManagementService();
    const result = await staffService.getWebhookUrl(property.sales_assignee);
    if (!result.success || !result.webhookUrl) {
      res.status(404).json({ error: result.error || '担当者のChat webhook URLが見つかりませんでした' });
      return;
    }

    // 物件詳細画面のURL
    const propertyUrl = `https://sateituikyaku-admin-frontend.vercel.app/property-listings/${property.property_number}`;

    // Google Chatにメッセージ送信
    const sellerInfo = [
      property.seller_name ? `売主氏名: ${property.seller_name}` : null,
      property.seller_contact ? `売主電話: ${property.seller_contact}` : null,
      property.seller_email ? `売主メール: ${property.seller_email}` : null,
    ].filter(Boolean).join('\n');

    const senderLabel = senderName ? `送信者: ${senderName}` : null;

    // messageから📷で始まる画像URLを抽出し、テキスト部分と分離
    const messageStr = String(message).trim();
    const imageUrls: string[] = [];
    const textLines = messageStr.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('📷 ')) {
        const url = trimmed.replace(/^📷\s+/, '').trim();
        if (url) imageUrls.push(url);
        return false; // テキスト部分から除外
      }
      return true;
    });
    const textOnly = textLines.join('\n').trim();

    // Google DriveのURLを直接表示可能な形式に変換
    // /file/d/FILE_ID/view → https://drive.google.com/uc?export=view&id=FILE_ID
    const toDirectImageUrl = (url: string): string => {
      const match = url.match(/\/file\/d\/([^/]+)\//);
      if (match) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      }
      return url;
    };

    const chatMessage = `📩 *物件担当への質問・伝言*\n\n物件番号: ${property.property_number}\n所在地: ${property.address || '未設定'}\n担当: ${property.sales_assignee}\n${sellerInfo ? sellerInfo + '\n' : ''}物件URL: ${propertyUrl}\n${senderLabel ? senderLabel + '\n' : ''}\n${textOnly}`;

    if (imageUrls.length > 0) {
      // 画像がある場合はcardsV2形式で送信（画像をインライン表示）
      const imageWidgets = imageUrls.map(url => ({
        image: {
          imageUrl: toDirectImageUrl(url),
          altText: '添付画像',
        },
      }));

      const payload = {
        text: chatMessage,
        cardsV2: [
          {
            cardId: 'imageCard',
            card: {
              sections: [
                {
                  widgets: imageWidgets,
                },
              ],
            },
          },
        ],
      };
      await axios.post(result.webhookUrl, payload);
    } else {
      // 画像なしの場合はテキストのみ
      await axios.post(result.webhookUrl, { text: chatMessage });
    }

    console.log(`[send-chat-to-assignee] Sent to ${property.sales_assignee} for ${propertyNumber}`);
    // CHAT送信履歴を保存
    try {
      await supabase
        .from('property_chat_history')
        .insert({
          property_number: propertyNumber,
          recipient_type: 'assignee',
          recipient_name: property.sales_assignee || '',
          message: String(message).trim(),
          sender_label: senderLabel || null,
          sent_at: new Date().toISOString(),
        });
      console.log(`[send-chat-to-assignee] Chat history saved for ${propertyNumber}`);
    } catch (historyError: any) {
      console.error(`[send-chat-to-assignee] Failed to save chat history:`, historyError);
      // 履歴保存エラーでもレスポンスは成功を返す
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[send-chat-to-assignee] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});

// 確認フィールドを更新
router.put('/:propertyNumber/confirmation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { confirmation } = req.body;

    // バリデーション
    if (!confirmation || !['未', '済'].includes(confirmation)) {
      res.status(400).json({ 
        error: '確認フィールドは「未」または「済」のみ有効です',
        code: 'INVALID_CONFIRMATION_VALUE'
      });
      return;
    }

    console.log(`[confirmation] Updating confirmation for ${propertyNumber} to ${confirmation}`);

    await propertyListingService.updateConfirmation(propertyNumber, confirmation);

    res.json({ 
      success: true,
      message: `確認を「${confirmation}」に更新しました`
    });
  } catch (error: any) {
    console.error('[confirmation] Error:', error);
    res.status(500).json({ 
      error: error.message || '確認の更新に失敗しました',
      code: 'INTERNAL_ERROR'
    });
  }
});

// 事務へチャット送信（物件担当がいる場合は担当へ、いない場合は事務チャットへ）
router.post('/:propertyNumber/send-chat-to-office', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { message, senderName } = req.body;

    if (!message || !String(message).trim()) {
      res.status(400).json({ error: 'メッセージを入力してください' });
      return;
    }

    const { StaffManagementService } = require('../services/StaffManagementService');
    const axios = require('axios');

    // 物件情報を取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee, seller_name, seller_contact, seller_email, owner_info')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    // 売主名のフォールバックロジック: seller_nameが空または"様"のみの場合はowner_infoを使用
    const resolveSellerName = (sellerName: string | null | undefined, ownerInfo: string | null | undefined): string | null => {
      const trimmed = (sellerName || '').trim();
      const isBlankOrSamaOnly = !trimmed || trimmed === '様';
      return isBlankOrSamaOnly ? (ownerInfo || null) : trimmed;
    };
    const effectiveSellerName = resolveSellerName(property.seller_name, property.owner_info);

    const staffService = new StaffManagementService();
    const propertyUrl = `https://sateituikyaku-admin-frontend.vercel.app/property-listings/${property.property_number}`;

    // 売主情報
    const sellerInfo = [
      effectiveSellerName ? `売主氏名: ${effectiveSellerName}` : null,
      property.seller_contact ? `売主電話: ${property.seller_contact}` : null,
      property.seller_email ? `売主メール: ${property.seller_email}` : null,
    ].filter(Boolean).join('\n');

    const senderLabel = senderName ? `送信者: ${senderName}` : null;

    // 物件担当がいる場合は担当へ送信
    if (property.sales_assignee) {
      const result = await staffService.getWebhookUrl(property.sales_assignee);
      if (result.success && result.webhookUrl) {
        const chatMessage = `📩 *事務への質問・伝言*\n\n物件番号: ${property.property_number}\n所在地: ${property.address || '未設定'}\n担当: ${property.sales_assignee}\n${sellerInfo ? sellerInfo + '\n' : ''}物件URL: ${propertyUrl}\n${senderLabel ? senderLabel + '\n' : ''}\n${String(message).trim()}`;
        await axios.post(result.webhookUrl, { text: chatMessage });
        
        console.log(`[send-chat-to-office] Sent to assignee ${property.sales_assignee} for ${propertyNumber}`);
        
        // 履歴を保存
        try {
          await supabase
            .from('property_chat_history')
            .insert({
              property_number: propertyNumber,
              chat_type: 'office',
              message: String(message).trim(),
              sender_name: senderName || '不明',
              sent_at: new Date().toISOString(),
            });
          console.log(`[send-chat-to-office] Saved chat history for ${propertyNumber}`);
        } catch (historyError: any) {
          console.error(`[send-chat-to-office] Failed to save chat history:`, historyError);
          // 履歴保存失敗でもチャット送信は成功しているのでエラーにしない
        }
        
        // 確認フィールドを「未」に自動設定
        await supabase
          .from('property_listings')
          .update({ confirmation: '未' })
          .eq('property_number', propertyNumber);
        
        // スプレッドシートへ直接同期（キューを使わず即座に実行）
        try {
          const { PropertyListingSpreadsheetSync } = await import('../services/PropertyListingSpreadsheetSync');
          const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
          
          const spreadsheetId = process.env.PROPERTY_LISTING_SPREADSHEET_ID || '';
          console.log(`[send-chat-to-office] PROPERTY_LISTING_SPREADSHEET_ID: ${spreadsheetId ? '設定済み' : '未設定'}`);
          
          if (!spreadsheetId) {
            throw new Error('PROPERTY_LISTING_SPREADSHEET_ID is not set');
          }
          
          const sheetsClient = new GoogleSheetsClient({
            spreadsheetId,
            sheetName: '物件',
          });
          await sheetsClient.authenticate();
          const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
          await syncService.syncConfirmationToSpreadsheet(propertyNumber, '未');
          console.log(`[send-chat-to-office] Successfully synced confirmation to spreadsheet for ${propertyNumber}`);
        } catch (syncError: any) {
          console.error(`[send-chat-to-office] Failed to sync confirmation to spreadsheet for ${propertyNumber}:`, syncError);
          console.error(`[send-chat-to-office] Error details:`, {
            message: syncError.message,
            stack: syncError.stack,
            spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID ? '設定済み' : '未設定'
          });
          // 同期エラーでもレスポンスは成功を返す（チャット送信は成功しているため）
        }
        
        res.json({ success: true });
        return;
      }
    }

    // 物件担当がいない場合は事務チャットへ送信
    console.log(`[send-chat-to-office] No assignee for ${propertyNumber}, sending to office chat`);
    
    const officeWebhookUrl = 'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';
    const chatMessage = `📩 *事務への質問・伝言*\n\n物件番号: ${property.property_number}\n所在地: ${property.address || '未設定'}\n担当: 未設定\n${sellerInfo ? sellerInfo + '\n' : ''}物件URL: ${propertyUrl}\n${senderLabel ? senderLabel + '\n' : ''}\n${String(message).trim()}`;

    await axios.post(officeWebhookUrl, { text: chatMessage });
    console.log(`[send-chat-to-office] Sent to office chat for ${propertyNumber}`);

    // 履歴を保存
    try {
      await supabase
        .from('property_chat_history')
        .insert({
          property_number: propertyNumber,
          chat_type: 'office',
          message: String(message).trim(),
          sender_name: senderName || '不明',
          sent_at: new Date().toISOString(),
        });
      console.log(`[send-chat-to-office] Saved chat history for ${propertyNumber}`);
    } catch (historyError: any) {
      console.error(`[send-chat-to-office] Failed to save chat history:`, historyError);
      // 履歴保存失敗でもチャット送信は成功しているのでエラーにしない
    }

    // 確認フィールドを「未」に自動設定
    await supabase
      .from('property_listings')
      .update({ confirmation: '未' })
      .eq('property_number', propertyNumber);

    // スプレッドシートへ直接同期（キューを使わず即座に実行）
    try {
      const { PropertyListingSpreadsheetSync } = await import('../services/PropertyListingSpreadsheetSync');
      const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
      
      const spreadsheetId = process.env.PROPERTY_LISTING_SPREADSHEET_ID || '';
      console.log(`[send-chat-to-office] PROPERTY_LISTING_SPREADSHEET_ID: ${spreadsheetId ? '設定済み' : '未設定'}`);
      
      if (!spreadsheetId) {
        throw new Error('PROPERTY_LISTING_SPREADSHEET_ID is not set');
      }
      
      const sheetsClient = new GoogleSheetsClient({
        spreadsheetId,
        sheetName: '物件',
      });
      await sheetsClient.authenticate();
      const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
      await syncService.syncConfirmationToSpreadsheet(propertyNumber, '未');
      console.log(`[send-chat-to-office] Successfully synced confirmation to spreadsheet for ${propertyNumber}`);
    } catch (syncError: any) {
      console.error(`[send-chat-to-office] Failed to sync confirmation to spreadsheet for ${propertyNumber}:`, syncError);
      console.error(`[send-chat-to-office] Error details:`, {
        message: syncError.message,
        stack: syncError.stack,
        spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID ? '設定済み' : '未設定'
      });
      // 同期エラーでもレスポンスは成功を返す（チャット送信は成功しているため）
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[send-chat-to-office] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});



// CHAT送信履歴取得API
// seller_email / seller_sms / seller_gmail の chat_type にも対応
// レスポンスに subject フィールドを含む（sent_at 降順・最大50件）
router.get('/:propertyNumber/chat-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { chat_type, limit } = req.query;
    
    // property_chat_historyテーブルから履歴を取得（新しい順）
    // subject カラムを含む全フィールドを取得
    let query = supabase
      .from('property_chat_history')
      .select('id, property_number, chat_type, subject, message, sender_name, sent_at, created_at')
      .eq('property_number', propertyNumber);
    
    // chat_typeでフィルタリング（指定なしの場合は全種別を返す）
    if (chat_type) {
      query = query.eq('chat_type', chat_type as string);
    }
    
    // sent_at 降順にソート（新しい順）
    query = query.order('sent_at', { ascending: false });
    
    // 件数制限（デフォルト最大50件）
    const maxLimit = limit ? Math.min(Number(limit), 50) : 50;
    query = query.limit(maxLimit);
    
    const { data: history, error } = await query;
    
    if (error) {
      console.error('[get-chat-history] Error:', error);
      res.status(500).json({ error: 'CHAT送信履歴の取得に失敗しました' });
      return;
    }
    
    res.json({ history: history || [] });
  } catch (error: any) {
    console.error('[get-chat-history] Error:', error.message);
    res.status(500).json({ error: error.message || 'CHAT送信履歴の取得に失敗しました' });
  }
});


// 売主への送信履歴保存API
// POST /api/property-listings/:propertyNumber/seller-send-history
router.post('/:propertyNumber/seller-send-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { chat_type, subject, message, sender_name } = req.body;

    // chat_type のバリデーション（seller_email / seller_sms / seller_gmail のみ許可）
    const validChatTypes = ['seller_email', 'seller_sms', 'seller_gmail'];
    if (!chat_type || !validChatTypes.includes(chat_type)) {
      res.status(400).json({
        error: '無効な送信種別です',
        code: 'INVALID_CHAT_TYPE',
      });
      return;
    }

    // property_chat_history テーブルに履歴を保存
    const { error } = await supabase
      .from('property_chat_history')
      .insert({
        property_number: propertyNumber,
        chat_type,
        subject: subject || '',
        message: message || '',
        sender_name: sender_name || '',
        sent_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[seller-send-history] DB insert error:', error);
      res.status(500).json({ error: '送信履歴の保存に失敗しました' });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[seller-send-history] Error:', error.message);
    res.status(500).json({ error: error.message || '送信履歴の保存に失敗しました' });
  }
});


// 一般媒介非公開（仮）フィールドを更新
// PUT /api/property-listings/:propertyNumber/general-mediation-private
router.put('/:propertyNumber/general-mediation-private', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { generalMediationPrivate } = req.body;

    // バリデーション
    if (!generalMediationPrivate || !['非公開予定', '不要'].includes(generalMediationPrivate)) {
      res.status(400).json({
        error: '一般媒介非公開（仮）フィールドは「非公開予定」または「不要」のみ有効です',
        code: 'INVALID_GENERAL_MEDIATION_PRIVATE_VALUE',
      });
      return;
    }

    await propertyListingService.updateGeneralMediationPrivate(propertyNumber, generalMediationPrivate);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[general-mediation-private] Error:', error);
    res.status(500).json({
      error: error.message || '一般媒介非公開（仮）の更新に失敗しました',
      code: 'INTERNAL_ERROR',
    });
  }
});

// 非公開配信メールフィールドを更新
// PUT /api/property-listings/:propertyNumber/private-mail-delivery
router.put('/:propertyNumber/private-mail-delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { privateMailDelivery } = req.body;

    if (!privateMailDelivery || !['未', '済'].includes(privateMailDelivery)) {
      res.status(400).json({
        error: '非公開配信メールフィールドは「未」または「済」のみ有効です',
        code: 'INVALID_VALUE',
      });
      return;
    }

    await propertyListingService.updatePrivateMailDelivery(propertyNumber, privateMailDelivery);

    res.json({ success: true, message: `非公開配信メールを「${privateMailDelivery}」に更新しました` });
  } catch (error: any) {
    console.error('[private-mail-delivery] Error:', error);
    res.status(500).json({
      error: error.message || '非公開配信メールの更新に失敗しました',
      code: 'INTERNAL_ERROR',
    });
  }
});

// seller_phone バックフィル: property_listings の seller_phone を sellers テーブルから一括補完
// 戸建て物件のハウスメーカーを一括同期（個別エンドポイントより前に定義する必要あり）
// POST /api/property-listings/sync-house-maker-bulk
router.post('/sync-house-maker-bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    // 戸建て物件を全件取得
    const { data: listings, error: fetchError } = await supabase
      .from('property_listings')
      .select('property_number, property_type')
      .not('property_number', 'is', null);

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    // 戸建て判定
    const detachedListings = (listings || []).filter((l: any) => {
      const pt = (l.property_type || '').toLowerCase();
      return pt === 'detached_house' || pt.includes('戸建') || pt === '戸';
    });

    if (detachedListings.length === 0) {
      res.json({ success: true, total: 0, synced: 0, failed: 0, skipped: 0, results: [] });
      return;
    }

    const { AthomeSheetSyncService } = await import('../services/AthomeSheetSyncService');
    const athomeService = new AthomeSheetSyncService();

    let synced = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{ property_number: string; status: string; house_maker?: string }> = [];

    for (const listing of detachedListings) {
      try {
        const houseMaker = await athomeService.syncHouseMaker(listing.property_number);
        if (houseMaker !== null) {
          synced++;
          results.push({ property_number: listing.property_number, status: 'synced', house_maker: houseMaker });
        } else {
          skipped++;
          results.push({ property_number: listing.property_number, status: 'skipped' });
        }
        // Google Sheets APIレート制限対策（1秒待機）
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        failed++;
        results.push({ property_number: listing.property_number, status: 'failed' });
        console.error(`[sync-house-maker-bulk] Failed for ${listing.property_number}:`, err.message);
      }
    }

    res.json({
      success: true,
      total: detachedListings.length,
      synced,
      failed,
      skipped,
      results,
    });
  } catch (error: any) {
    console.error('[sync-house-maker-bulk] Error:', error);
    res.status(500).json({ error: error.message || 'ハウスメーカー一括同期に失敗しました' });
  }
});

// ハウスメーカーをathomeシートF10セルから同期
// POST /api/property-listings/:propertyNumber/sync-house-maker
router.post('/:propertyNumber/sync-house-maker', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;

    // 物件種別を確認（戸建てのみ対象）
    const { data: listing, error: fetchError } = await supabase
      .from('property_listings')
      .select('property_type')
      .eq('property_number', propertyNumber)
      .single();

    if (fetchError || !listing) {
      res.status(404).json({ error: '物件が見つかりません' });
      return;
    }

    const pt = (listing.property_type || '').toLowerCase();
    const isDetachedHouse =
      pt === 'detached_house' ||
      pt.includes('戸建') ||
      pt.includes('戸建て') ||
      pt === '戸';

    if (!isDetachedHouse) {
      res.status(400).json({ error: 'ハウスメーカー同期は戸建て物件のみ対応しています' });
      return;
    }

    const { AthomeSheetSyncService } = await import('../services/AthomeSheetSyncService');
    const athomeService = new AthomeSheetSyncService();
    const houseMaker = await athomeService.syncHouseMaker(propertyNumber);

    if (houseMaker === null) {
      res.json({ success: false, message: 'スプシのF10セルが空か、スプシが見つかりませんでした' });
      return;
    }

    res.json({ success: true, house_maker: houseMaker });
  } catch (error: any) {
    console.error('[sync-house-maker] Error:', error);
    res.status(500).json({ error: error.message || 'ハウスメーカー同期に失敗しました' });
  }
});

// ===== 周辺事例取得エンドポイント =====
// SUUMO URLから周辺エリアの物件一覧を取得する（土地・中古一戸建て・マンション対応）
router.get('/:propertyNumber/nearby-cases', authenticate, async (req: Request, res: Response) => {
  const { propertyNumber } = req.params;
  const { suumo_url } = req.query as { suumo_url?: string };

  try {
    // SUUMO URLの種別判定
    const isTochi        = !!suumo_url && suumo_url.includes('suumo.jp/tochi/');
    const isChukoikkodate = !!suumo_url && suumo_url.includes('suumo.jp/chukoikkodate/');
    const isManshon      = !!suumo_url && (
      suumo_url.includes('suumo.jp/ms/') || suumo_url.includes('suumo.jp/chukomansion/')
    );

    if (!suumo_url || (!isTochi && !isChukoikkodate && !isManshon)) {
      res.status(400).json({ error: 'SUUMO URLからエリアを特定できませんでした。SUUMO URLを正しく設定してください。' });
      return;
    }

    // pref / city を抽出
    // 土地:         /tochi/{pref}/{city}/nc_xxxxx/
    // 中古一戸建て: /chukoikkodate/{pref}/{city}/nc_xxxxx/
    // マンション:   /ms/chuko/{pref}/{city}/nc_xxxxx/ または /chukomansion/{pref}/{city}/nc_xxxxx/
    let urlPattern: RegExp;
    if (isTochi)          urlPattern = /suumo\.jp\/tochi\/([^/]+)\/([^/]+)\//;
    else if (isChukoikkodate) urlPattern = /suumo\.jp\/chukoikkodate\/([^/]+)\/([^/]+)\//;
    else                  urlPattern = /suumo\.jp\/(?:ms\/chuko|chukomansion)\/([^/]+)\/([^/]+)\//;

    const cityMatch = suumo_url.match(urlPattern);
    if (!cityMatch) {
      res.status(400).json({ error: 'SUUMO URLの形式が不正です。' });
      return;
    }
    const pref = cityMatch[1];
    const city = cityMatch[2];

    // case_type: レスポンスでフロントに種別を伝える
    const case_type: 'tochi' | 'chukoikkodate' | 'manshon' =
      isTochi ? 'tochi' : isChukoikkodate ? 'chukoikkodate' : 'manshon';

    const axios = require('axios');
    const fetchHtml = async (url: string): Promise<string> => {
      const r = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en-US;q=0.9',
        },
        timeout: 20000,
        responseType: 'arraybuffer',
      });
      return Buffer.from(r.data).toString('utf-8');
    };

    // ── STEP 1: 物件個別ページから oz_コード と 座標 を取得（土地のみ oz_ を使用）──
    let areaCode = '';
    let targetLat = 0;
    let targetLng = 0;
    try {
      const propHtml = await fetchHtml(suumo_url);

      // 座標取得
      const idoM = propHtml.match(/initIdo\s*:\s*'([0-9.]+)'/);
      const keidoM = propHtml.match(/initKeido\s*:\s*'([0-9.]+)'/);
      if (idoM && keidoM) {
        targetLat = parseFloat(idoM[1]);
        targetLng = parseFloat(keidoM[1]);
      }

      // 土地の場合のみ oz_ コードを取得してエリアを絞り込む
      if (isTochi) {
        const addrPatterns = [
          /住所<\/th>\s*<td[^>]*>\s*<p>((?:大分|福岡|熊本|佐賀|長崎|宮崎|鹿児島|沖縄|東京|大阪|愛知)[^\n<]{3,60})<\/p>/,
          /<dt[^>]*>所在地<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/,
        ];
        let fullAddress = '';
        for (const pat of addrPatterns) {
          const m = propHtml.match(pat);
          if (m) {
            fullAddress = m[1].replace(/<[^>]+>/g, '').trim();
            if (fullAddress.length > 5) break;
          }
        }

        const townCandidates: string[] = [];
        const daijiMatch = fullAddress.match(/大字([^\s　0-9０-９番地号\-ー]{2,8})/);
        if (daijiMatch) {
          townCandidates.push('大字' + daijiMatch[1]);
          townCandidates.push(daijiMatch[1]);
        }
        const townMatch2 = fullAddress.match(/[市区][^\s　]*((?:大字|字|町|丁目)?[^\s　0-9０-９番地号\-ー]{2,8})/);
        if (townMatch2 && !townCandidates.includes(townMatch2[1])) {
          townCandidates.push(townMatch2[1]);
          townCandidates.push(townMatch2[1].replace(/^大字/, '').replace(/^字/, ''));
        }

        const ozMapPattern = /href="\/tochi\/[^"]*\/(oz_[0-9]+)\/"[^>]*>([^<]{2,20})<\/a>/g;
        let ozMapMatch;
        const ozMap: Array<{ code: string; name: string }> = [];
        while ((ozMapMatch = ozMapPattern.exec(propHtml)) !== null) {
          ozMap.push({ code: ozMapMatch[1], name: ozMapMatch[2].trim() });
        }

        for (const candidate of townCandidates) {
          const found = ozMap.find(o => o.name.includes(candidate) || candidate.includes(o.name));
          if (found) { areaCode = found.code; break; }
        }
        if (!areaCode && fullAddress) {
          for (const oz of ozMap) {
            if (fullAddress.includes(oz.name) && oz.name.length >= 2) { areaCode = oz.code; break; }
          }
        }
      }
    } catch { /* 失敗は無視 */ }

    // ── STEP 2: エリア一覧ページのURL決定 ──
    let targetUrl: string;
    if (isTochi) {
      targetUrl = areaCode
        ? `https://suumo.jp/tochi/${pref}/${city}/${areaCode}/`
        : `https://suumo.jp/tochi/${pref}/${city}/`;
    } else if (isChukoikkodate) {
      targetUrl = `https://suumo.jp/chukoikkodate/${pref}/${city}/`;
    } else {
      // マンション: /ms/chuko/{pref}/{city}/
      targetUrl = `https://suumo.jp/ms/chuko/${pref}/${city}/`;
    }

    const targetHtml = await fetchHtml(targetUrl);

    // ── STEP 3: HTMLタグ除去ヘルパー ──
    const stripTags = (s: string) =>
      s.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z]+;/g, (m) => {
        const map: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"' };
        return map[m] || m;
      }).replace(/\s+/g, ' ').trim();

    // 価格取得共通ヘルパー
    const extractPrice = (block: string): string => {
      const m1 = block.match(/<dt[^>]*>販売価格<\/dt>[\s\S]{0,300}?<span[^>]*class="dottable-value"[^>]*>([\s\S]{0,100}?)<\/span>/);
      if (m1) return stripTags(m1[1]);
      const m2 = block.match(/<dt[^>]*>販売価格<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
      if (m2) return stripTags(m2[1]);
      return '-';
    };

    // 所在地取得共通ヘルパー
    const extractAddress = (block: string): string => {
      const m = block.match(/<dt[^>]*>所在地<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
      return m ? stripTags(m[1]) : '-';
    };

    // ── STEP 3a: 物件ブロック分割パターン（種別ごと）──
    type CaseType = 'tochi' | 'chukoikkodate' | 'manshon';

    interface NearbyCase {
      case_type: CaseType;
      title: string;
      price: string;
      address: string;
      // 土地専用
      area?: string;
      tsubo?: string;
      tsubo_tanka?: string;
      building_condition?: string;
      // 中古一戸建て・マンション共通
      built_year?: string;       // 築年数（必須）
      // 中古一戸建て専用
      building_area?: string;    // 建物面積（必須）
      land_area_str?: string;    // 土地面積
      // マンション専用
      exclusive_area?: string;   // 専有面積（必須）
      floor_plan?: string;       // 間取り
      url: string;
    }

    const cases: NearbyCase[] = [];

    if (isTochi) {
      // ── 土地ブロック解析 ──
      const blocks = targetHtml.split(/(?=<h2[^>]*>\s*<a[^>]+\/tochi\/[^"]*nc_[0-9]+[^"]*")/g).slice(1);
      for (const block of blocks) {
        const urlMatch = block.match(/href="(\/tochi\/[^"]*nc_[0-9]+[^"]*)"/);
        if (!urlMatch) continue;
        const url = `https://suumo.jp${urlMatch[1]}`;
        const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]+>([^<]+)<\/a>/);
        const title = titleMatch ? titleMatch[1].trim() : '-';
        const price = extractPrice(block);
        const address = extractAddress(block);

        let area = '-';
        let tsubo = '-';
        const areaM = block.match(/<dt[^>]*>土地面積<\/dt>\s*<dd[^>]*>([\s\S]{0,300}?)<\/dd>/);
        if (areaM) {
          const areaRaw = stripTags(areaM[1]).replace('（登記）', '').trim();
          area = areaRaw;
          const tsuboM = areaRaw.match(/（([0-9.]+坪(?:～[0-9.]+坪)?)/);
          if (tsuboM) {
            tsubo = tsuboM[1];
          } else {
            const sqmM = areaRaw.match(/([0-9,.]+)m2/);
            if (sqmM) {
              const sqm = parseFloat(sqmM[1].replace(',', ''));
              if (!isNaN(sqm) && sqm > 0) tsubo = `${(sqm / 3.30578).toFixed(1)}坪`;
            }
          }
        }

        let tsubo_tanka = '-';
        const tankaM = block.match(/<dt[^>]*>坪単価<\/dt>\s*<dd[^>]*>([\s\S]{0,100}?)<\/dd>/);
        if (tankaM) {
          const raw = stripTags(tankaM[1]).replace('／', '/').replace(/\s+/g, '');
          if (raw && raw !== '-') tsubo_tanka = raw;
        }
        if (tsubo_tanka === '-' && tsubo !== '-' && price !== '-') {
          const tsuboNum = tsubo.match(/([0-9.]+)坪/);
          const priceNum = price.match(/([0-9,]+)万/);
          if (tsuboNum && priceNum) {
            const t = parseFloat(tsuboNum[1]);
            const p = parseInt(priceNum[1].replace(/,/g, ''), 10);
            if (t > 0 && p > 0) tsubo_tanka = `${(p / t).toFixed(1)}万円/坪`;
          }
        }
        const building_condition = block.includes('建築条件付土地') ? 'あり' : 'なし';
        cases.push({ case_type: 'tochi', title, price, address, area, tsubo, tsubo_tanka, building_condition, url });
      }

    } else if (isChukoikkodate) {
      // ── 中古一戸建てブロック解析 ──
      // SUUMOの中古一戸建て一覧: h2 > a[href*=/chukoikkodate/...nc_]
      const blocks = targetHtml.split(/(?=<h2[^>]*>\s*<a[^>]+\/chukoikkodate\/[^"]*nc_[0-9]+[^"]*")/g).slice(1);
      for (const block of blocks) {
        const urlMatch = block.match(/href="(\/chukoikkodate\/[^"]*nc_[0-9]+[^"]*)"/);
        if (!urlMatch) continue;
        const url = `https://suumo.jp${urlMatch[1]}`;
        const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]+>([^<]+)<\/a>/);
        const title = titleMatch ? titleMatch[1].trim() : '-';
        const price = extractPrice(block);
        const address = extractAddress(block);

        // 建物面積（必須）
        let building_area = '-';
        const bldAreaM = block.match(/<dt[^>]*>建物面積<\/dt>\s*<dd[^>]*>([\s\S]{0,300}?)<\/dd>/);
        if (bldAreaM) building_area = stripTags(bldAreaM[1]).replace('（登記）', '').trim();

        // 土地面積
        let land_area_str = '-';
        const landAreaM = block.match(/<dt[^>]*>土地面積<\/dt>\s*<dd[^>]*>([\s\S]{0,300}?)<\/dd>/);
        if (landAreaM) land_area_str = stripTags(landAreaM[1]).replace('（登記）', '').trim();

        // 築年数（必須）: 「築年月」または「築年数」
        let built_year = '-';
        const builtM = block.match(/<dt[^>]*>築年月<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
        if (builtM) {
          built_year = stripTags(builtM[1]).trim();
        } else {
          const builtM2 = block.match(/<dt[^>]*>築年数<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
          if (builtM2) built_year = stripTags(builtM2[1]).trim();
        }

        cases.push({ case_type: 'chukoikkodate', title, price, address, building_area, land_area_str, built_year, url });
      }

    } else {
      // ── マンションブロック解析 ──
      // SUUMOの中古マンション一覧: h2 > a[href*=/ms/...nc_] または /chukomansion/
      const blocks = targetHtml.split(/(?=<h2[^>]*>\s*<a[^>]+\/(?:ms\/|chukomansion\/)[^"]*nc_[0-9]+[^"]*")/g).slice(1);
      for (const block of blocks) {
        const urlMatch = block.match(/href="(\/(?:ms\/|chukomansion\/)[^"]*nc_[0-9]+[^"]*)"/);
        if (!urlMatch) continue;
        const url = `https://suumo.jp${urlMatch[1]}`;
        const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]+>([^<]+)<\/a>/);
        const title = titleMatch ? titleMatch[1].trim() : '-';
        const price = extractPrice(block);
        const address = extractAddress(block);

        // 専有面積（必須）
        let exclusive_area = '-';
        const exAreaM = block.match(/<dt[^>]*>専有面積<\/dt>\s*<dd[^>]*>([\s\S]{0,300}?)<\/dd>/);
        if (exAreaM) exclusive_area = stripTags(exAreaM[1]).trim();

        // 築年数（必須）
        let built_year = '-';
        const builtM = block.match(/<dt[^>]*>築年月<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
        if (builtM) {
          built_year = stripTags(builtM[1]).trim();
        } else {
          const builtM2 = block.match(/<dt[^>]*>築年数<\/dt>\s*<dd[^>]*>([\s\S]{0,200}?)<\/dd>/);
          if (builtM2) built_year = stripTags(builtM2[1]).trim();
        }

        // 間取り
        let floor_plan = '-';
        const fpM = block.match(/<dt[^>]*>間取り<\/dt>\s*<dd[^>]*>([\s\S]{0,100}?)<\/dd>/);
        if (fpM) floor_plan = stripTags(fpM[1]).trim();

        cases.push({ case_type: 'manshon', title, price, address, exclusive_area, built_year, floor_plan, url });
      }
    }

    // ── 重複排除 + 対象物件自身を除外 ──
    const targetNcPath = suumo_url ? suumo_url.replace('https://suumo.jp', '').replace(/\/$/, '') : '';
    const seen = new Set<string>();
    const dedupedCases = cases.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      const cNcPath = c.url.replace('https://suumo.jp', '').replace(/\/$/, '');
      if (targetNcPath && cNcPath === targetNcPath) return false;
      return true;
    });

    // ── STEP 4: 各物件ページから座標を取得して1km以内でフィルタリング ──
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let uniqueCases = dedupedCases;

    if (targetLat && targetLng && dedupedCases.length > 0) {
      const RADIUS_KM = 1.0;
      const casesWithCoords = await Promise.all(
        dedupedCases.map(async (c) => {
          if (!c.url) return { ...c, distKm: 999 };
          try {
            const cHtml = await fetchHtml(c.url);
            const idoM = cHtml.match(/initIdo\s*:\s*'([0-9.]+)'/);
            const keidoM = cHtml.match(/initKeido\s*:\s*'([0-9.]+)'/);
            if (idoM && keidoM) {
              const distKm = haversineKm(
                targetLat, targetLng,
                parseFloat(idoM[1]), parseFloat(keidoM[1])
              );
              return { ...c, distKm };
            }
          } catch { /* 座標取得失敗は含める */ }
          return { ...c, distKm: 0 };
        })
      );

      uniqueCases = casesWithCoords
        .filter((c) => c.distKm <= RADIUS_KM || c.distKm === 0)
        .sort((a, b) => a.distKm - b.distKm)
        .map(({ distKm, ...rest }) => rest);
    }

    res.json({
      cases: uniqueCases,
      case_type,
      source_url: targetUrl,
      area_code: areaCode,
      target_lat: targetLat,
      target_lng: targetLng,
      total: uniqueCases.length,
    });

  } catch (error: any) {
    console.error('[nearby-cases] Error:', error.message);
    res.status(500).json({ error: '周辺事例の取得に失敗しました: ' + (error.message || '') });
  }
});

// Gmail送信済みメールから報告書送信履歴を復元するエンドポイント（一度だけ実行）
router.post('/admin/restore-report-history-from-gmail', async (req: Request, res: Response): Promise<void> => {
  try {
    const { google } = require('googleapis');
    const { GoogleAuthService } = await import('../services/GoogleAuthService');
    
    const googleAuthService = new GoogleAuthService();
    const authClient = await googleAuthService.getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 物件番号パターン
    const PROPERTY_NUMBER_REGEX = /\b([A-Z]{2}\d{3,5}(?:-\d+)?)\b/;

    // 既存履歴を取得（重複防止）
    const { data: existingHistory } = await supabase
      .from('property_report_history')
      .select('property_number, sent_at');
    
    console.log(`[restore-report-history] 既存履歴: ${existingHistory?.length || 0}件`);

    // Gmail検索: 報告書メールを全件取得
    const queries = [
      'from:tenant@ifoo-oita.com subject:報告書 before:2026/03/15',
      'from:tenant@ifoo-oita.com subject:報告書 after:2026/03/14',
    ];

    let allMessages: any[] = [];

    for (const query of queries) {
      let nextPageToken: string | undefined;
      do {
        const listResult = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 100,
          pageToken: nextPageToken,
        });
        const messages = listResult.data.messages || [];
        allMessages = allMessages.concat(messages);
        nextPageToken = listResult.data.nextPageToken || undefined;
      } while (nextPageToken);
    }

    // 重複除去
    const uniqueMessages = Array.from(new Map(allMessages.map((m: any) => [m.id, m])).values());
    console.log(`[restore-report-history] Gmail対象メール: ${uniqueMessages.length}件`);

    // 各メールを解析
    const parsedEmails: any[] = [];
    let skipped = 0;
    let errors = 0;

    for (const msg of uniqueMessages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: (msg as any).id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Date', 'To', 'From'],
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';

        // 件名から物件番号を抽出
        const match = subject.match(PROPERTY_NUMBER_REGEX);
        if (!match) { skipped++; continue; }

        const propertyNumber = match[1];
        const sentAt = new Date(dateStr).toISOString();

        // テンプレート名推定
        let templateName = '';
        const templateMatch = subject.match(/報告書[（(]([^）)]+)[）)]/);
        if (templateMatch) {
          templateName = `報告書（${templateMatch[1]}）`;
        } else if (subject.includes('報告書_値下げ')) {
          const valueMatch = subject.match(/報告書_値下げ[^\s]*/);
          templateName = valueMatch ? valueMatch[0] : '報告書_値下げ';
        } else {
          templateName = '報告書';
        }

        // 重複チェック
        const sentDate = new Date(sentAt);
        const isDuplicate = (existingHistory || []).some((h: any) => {
          if (h.property_number !== propertyNumber) return false;
          const existingDate = new Date(h.sent_at);
          return Math.abs(existingDate.getTime() - sentDate.getTime()) < 60000;
        });

        if (isDuplicate) { skipped++; continue; }

        parsedEmails.push({
          property_number: propertyNumber,
          template_name: templateName || null,
          subject,
          body: null,
          report_assignee: null,
          sent_at: sentAt,
        });
      } catch (err: any) {
        errors++;
      }

      // レート制限対策
      if ((parsedEmails.length + skipped + errors) % 100 === 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`[restore-report-history] 挿入予定: ${parsedEmails.length}件, スキップ: ${skipped}件, エラー: ${errors}件`);

    // DBに挿入（バッチ処理）
    let inserted = 0;
    let insertErrors = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < parsedEmails.length; i += BATCH_SIZE) {
      const batch = parsedEmails.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from('property_report_history').insert(batch);
      if (error) {
        console.error(`[restore-report-history] バッチ挿入エラー:`, error.message);
        insertErrors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    res.json({
      success: true,
      gmailMessages: uniqueMessages.length,
      inserted,
      skipped,
      errors,
      insertErrors,
    });
  } catch (error: any) {
    console.error('[restore-report-history] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
