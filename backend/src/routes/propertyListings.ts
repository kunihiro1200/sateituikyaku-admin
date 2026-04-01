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

const router = Router();

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

    // Validate distribution_areas if provided
    if (updates.distribution_areas !== undefined && updates.distribution_areas !== null) {
      const { PropertyDistributionAreaCalculator } = await import('../services/PropertyDistributionAreaCalculator');
      const calculator = new PropertyDistributionAreaCalculator();
      
      if (!calculator.validateAreaNumbers(updates.distribution_areas)) {
        return res.status(400).json({ 
          error: 'Invalid distribution_areas format. Must contain only valid area numbers (①-⑯, ㊵, ㊶)' 
        });
      }
    }

    const data = await propertyListingService.update(propertyNumber, updates);
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

// 買主候補リスト取得（条件に合致する買主を抽出）
router.get('/:propertyNumber/buyer-candidates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;

    console.log(`[buyer-candidates] Fetching candidates for property: ${propertyNumber}`);

    const result = await buyerCandidateService.getCandidatesForProperty(propertyNumber);

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
router.post('/:propertyNumber/send-distribution-emails', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { recipientEmails, subject, content, htmlBody, from } = req.body;

    // バリデーション
    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return res.status(400).json({
        error: 'recipientEmails is required and must be a non-empty array'
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

    // 各受信者にメールを送信
    const results = await Promise.allSettled(
      recipientEmails.map(async (email: string) => {
        // ダミーのseller objectを作成（EmailServiceのインターフェースに合わせる）
        const dummySeller = {
          id: property.id,
          seller_number: propertyNumber,
          name: '買主様',
          email: email,
          phone_number: '',
          property_address: property.property_address || '',
          created_at: new Date(),
          updated_at: new Date()
        };

        return await emailService.sendTemplateEmail(
          dummySeller as any,
          subject,
          content,
          from,
          req.employee?.id || 'system',
          htmlBody,
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

    res.json({
      success: failedCount === 0,
      successCount,
      failedCount,
      totalCount: recipientEmails.length,
      error: failedCount > 0 ? allErrors : undefined
    });
  } catch (error: any) {
    console.error('Error sending distribution emails:', error);
    res.status(500).json({
      error: error.message || 'Failed to send distribution emails',
      success: false,
      successCount: 0,
      failedCount: req.body.recipientEmails?.length || 0
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

    const senderAddress = from || req.employee?.email || 'tenant@ifoo-oita.com';
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
    const attachments = (files || []).map((file) => ({
      filename: file.originalname,
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
      .select('property_number, address, sales_assignee, seller_name, seller_contact, seller_email')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    if (!property.sales_assignee) {
      res.status(400).json({ error: '物件担当が設定されていません' });
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
    const chatMessage = `📩 *物件担当への質問・伝言*\n\n物件番号: ${property.property_number}\n所在地: ${property.address || '未設定'}\n担当: ${property.sales_assignee}\n${sellerInfo ? sellerInfo + '\n' : ''}物件URL: ${propertyUrl}\n${senderLabel ? senderLabel + '\n' : ''}\n${String(message).trim()}`;
    await axios.post(result.webhookUrl, { text: chatMessage });

    console.log(`[send-chat-to-assignee] Sent to ${property.sales_assignee} for ${propertyNumber}`);
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
      .select('property_number, address, sales_assignee, seller_name, seller_contact, seller_email')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    const staffService = new StaffManagementService();
    const propertyUrl = `https://sateituikyaku-admin-frontend.vercel.app/property-listings/${property.property_number}`;

    // 売主情報
    const sellerInfo = [
      property.seller_name ? `売主氏名: ${property.seller_name}` : null,
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
        
        // 確認フィールドを「未」に自動設定
        await supabase
          .from('property_listings')
          .update({ confirmation: '未' })
          .eq('property_number', propertyNumber);
        
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

    // 確認フィールドを「未」に自動設定
    await supabase
      .from('property_listings')
      .update({ confirmation: '未' })
      .eq('property_number', propertyNumber);

    // スプレッドシートへ直接同期（キューを使わず即座に実行）
    try {
      const { PropertyListingSpreadsheetSync } = await import('../services/PropertyListingSpreadsheetSync');
      const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
      
      const sheetsClient = new GoogleSheetsClient();
      const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
      await syncService.syncConfirmationToSpreadsheet(propertyNumber, '未');
      console.log(`[send-chat-to-office] Successfully synced confirmation to spreadsheet for ${propertyNumber}`);
    } catch (syncError: any) {
      console.error(`[send-chat-to-office] Failed to sync confirmation to spreadsheet for ${propertyNumber}:`, syncError);
      // 同期エラーでもレスポンスは成功を返す（チャット送信は成功しているため）
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[send-chat-to-office] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});


export default router;
