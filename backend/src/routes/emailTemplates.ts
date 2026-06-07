import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { StaffManagementService } from '../services/StaffManagementService';
import { SellerService } from '../services/SellerService.supabase';
import { TemplateContext } from '../types/emailTemplate';

const router = express.Router();
const templateService = new EmailTemplateService();
const staffService = new StaffManagementService();
const sellerService = new SellerService();

/**
 * Debug endpoint - Google Sheets認証テスト
 * GET /api/email-templates/debug
 */
router.get('/debug', async (req, res) => {
  const debug: any = {
    env: {
      hasGOOGLE_SERVICE_ACCOUNT_JSON: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
      GOOGLE_SERVICE_ACCOUNT_JSON_length: process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length || 0,
      hasGOOGLE_SERVICE_ACCOUNT_KEY_PATH: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      GOOGLE_SERVICE_ACCOUNT_KEY_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '(not set)',
      hasGOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID: !!process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID,
      GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '(not set)',
    },
    steps: [] as string[],
    error: null as string | null,
    templates: null as any,
  };

  try {
    debug.steps.push('Starting authentication...');
    const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
    const spreadsheetId = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';
    const client = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: 'テンプレート',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    debug.steps.push('Authentication successful');

    debug.steps.push('Fetching spreadsheet data...');
    const sheetsInstance = (client as any).sheets;
    const response = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId,
      range: 'テンプレート!C:F',
    });
    const rows = response.data.values || [];
    debug.steps.push(`Got ${rows.length} rows`);
    // C列（区分）の全ユニーク値を確認
    const categories = [...new Set(rows.map((r: any[]) => (r[0] || '').toString().trim()))];
    debug.categories = categories;
    debug.firstRows = rows.slice(0, 10).map((r: any[]) => ({
      C: r[0], D: r[1], C_charCodes: (r[0] || '').split('').map((c: string) => c.charCodeAt(0))
    }));
    // 「買主」でフィルタした結果
    const buyerRows = rows.filter((r: any[]) => (r[0] || '').toString().trim() === '買主');
    debug.buyerRowCount = buyerRows.length;
    debug.templates = rows.slice(0, 5);
  } catch (err: any) {
    debug.error = err.message;
    debug.steps.push(`Error: ${err.message}`);
  }

  res.json(debug);
});

/**
 * Get all available email templates
 * GET /api/email-templates
 */
/**
 * 売主区分のテンプレート一覧を取得
 * GET /api/email-templates/seller
 */
router.get('/seller', async (req, res) => {
  try {
    const templates = await templateService.getSellerTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching seller templates:', error);
    res.status(500).json({ error: 'Failed to fetch seller templates', message: error.message });
  }
});

/**
 * 物件区分のテンプレート一覧を取得
 * GET /api/email-templates/property
 */
router.get('/property', async (req, res) => {
  try {
    const templates = await templateService.getPropertyTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching property templates:', error);
    res.status(500).json({ error: 'Failed to fetch property templates', message: error.message });
  }
});

/**
 * 物件区分のテンプレート一覧を取得（「報告」を含まないもの）
 * 物件詳細画面のEmail送信ボタン向け
 * GET /api/email-templates/property-non-report
 */
router.get('/property-non-report', async (req, res) => {
  try {
    const templates = await templateService.getPropertyNonReportTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching property non-report templates:', error);
    res.status(500).json({ error: 'Failed to fetch property non-report templates', message: error.message });
  }
});

/**
 * 物件報告メール用テンプレートをプレースホルダー置換して返す
 * POST /api/email-templates/property/merge
 * Body: { propertyNumber: string, templateId: string }
 */
router.post('/property/merge', async (req, res) => {
  try {
    const { propertyNumber, templateId } = req.body;

    if (!propertyNumber || !templateId) {
      return res.status(400).json({ error: 'propertyNumber and templateId are required' });
    }

    // テンプレート取得
    const templates = await templateService.getPropertyTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Supabase から物件データを取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: property, error: propError } = await supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (propError || !property) {
      return res.status(404).json({ error: 'Property not found', detail: propError?.message });
    }

    // 売主データを取得
    // property_listings テーブルから seller_name と owner_info を取得
    // seller_name が空または"様"のみの場合は owner_info にフォールバック
    let sellerName = '';
    let sellerEmail = '';
    
    const resolveSellerName = (sellerNameValue: string | null | undefined, ownerInfo: string | null | undefined): string | null => {
      const trimmed = (sellerNameValue || '').trim();
      const isBlankOrSamaOnly = !trimmed || trimmed === '様';
      return isBlankOrSamaOnly ? (ownerInfo || null) : trimmed;
    };
    
    const effectiveSellerName = resolveSellerName(property.seller_name, property.owner_info);
    if (effectiveSellerName) {
      sellerName = effectiveSellerName;
    }
    if (property.seller_email) {
      sellerEmail = property.seller_email;
    }

    // スタッフ情報を取得（sales_assignee のイニシャルまたは姓名の部分一致で検索）
    let staffInfo = null;
    const salesAssignee = property.sales_assignee;
    if (salesAssignee) {
      // まずイニシャルで完全一致検索
      staffInfo = await staffService.getStaffByInitials(salesAssignee);
      // 見つからない場合は姓名の部分一致で検索（例: "裏" → "裏天真"）
      if (!staffInfo) {
        staffInfo = await staffService.getStaffByNameContains(salesAssignee);
      }
    }

    // sellerName の末尾「様」を除去（mergePropertyTemplate 内で「様」を付けるため）
    const sellerNameClean = sellerName.endsWith('様') ? sellerName.slice(0, -1) : sellerName;

    // プレースホルダー置換
    const mergedSubject = templateService.mergePropertyTemplate(
      template.subject,
      property,
      sellerNameClean,
      staffInfo
    );
    const mergedBody = templateService.mergePropertyTemplate(
      template.body,
      property,
      sellerNameClean,
      staffInfo
    );

    // FI物件判定: 物件番号に「FI」が含まれる場合、会社名・署名を福岡（くじら不動産）用に置換
    let finalSubject = mergedSubject;
    let finalBody = mergedBody;
    if (propertyNumber.toUpperCase().includes('FI')) {
      finalBody = finalBody.replace(/株式会社 いふう/g, '株式会社くじら不動産（株式会社いふう）');
      finalBody = finalBody.replace(/株式会社いふうと申します。/g, '株式会社くじら不動産と申します。');
      finalBody = finalBody.replace(/いふうにてお手伝い/g, 'くじら不動産にてお手伝い');
      finalSubject = finalSubject.replace(/株式会社いふう/g, '株式会社くじら不動産');
      finalBody = finalBody.replace(/〒870-0044\n?大分市舞鶴町1丁目3-30/g, '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201');
      finalBody = finalBody.replace(/〒870-0044大分市舞鶴町1丁目3-30/g, '〒810-0073福岡市中央区舞鶴3-1-10オフィスニューガイアセレス赤坂門No.19 -201');
      finalBody = finalBody.replace(/大分市舞鶴町1-3-30/g, '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201');
      finalBody = finalBody.replace(/TEL：097-533-2022/g, 'TEL：092-401-5331');
      finalBody = finalBody.replace(/TEL:097-533-2022/g, 'TEL:092-401-5331');
      finalBody = finalBody.replace(/097-533-2022/g, '092-401-5331');
      finalBody = finalBody.replace(/tenant@ifoo-oita\.com/g, 'tenant@ifoo-oita.com');
    }

    res.json({ subject: finalSubject, body: finalBody, sellerName, sellerEmail });
  } catch (error: any) {
    console.error('Error merging property template:', error);
    res.status(500).json({ error: 'Failed to merge property template', message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const templates = await templateService.getTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    // 詳細なエラー情報を返す（デバッグ用）
    res.status(500).json({
      error: 'Failed to fetch email templates',
      message: error.message,
      env: {
        hasGOOGLE_SERVICE_ACCOUNT_JSON: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        hasGOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasGOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
        hasGOOGLE_SERVICE_ACCOUNT_KEY_PATH: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '(not set, using default)',
      }
    });
  }
});

/**
 * Get a specific email template by ID
 * GET /api/email-templates/:templateId
 */
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await templateService.getTemplateById(templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

/**
 * Get template preview with sample data
 * GET /api/email-templates/:templateId/preview
 */
router.get('/:templateId/preview', async (req, res) => {
  try {
    const { templateId } = req.params;
    const preview = await templateService.getTemplatePreview(templateId);
    
    if (!preview) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(preview);
  } catch (error: any) {
    console.error('Error generating template preview:', error);
    res.status(500).json({ error: 'Failed to generate template preview' });
  }
});

/**
 * Merge template with actual data
 * POST /api/email-templates/:templateId/merge
 * Body: { buyer: BuyerData, property?: PropertyData }
 */
router.post('/:templateId/merge', async (req, res) => {
  try {
    const { templateId } = req.params;
    const context: TemplateContext = req.body;
    
    // Validate context
    if (!context.buyer) {
      return res.status(400).json({ error: 'Buyer data is required' });
    }
    
    // Get template
    const template = await templateService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Validate placeholders
    const missingPlaceholders = templateService.validatePlaceholders(template, context);
    if (missingPlaceholders.length > 0) {
      return res.status(400).json({
        error: 'Missing required data for placeholders',
        missingPlaceholders
      });
    }
    
    // Merge template with data
    const mergedContent = templateService.mergePlaceholders(template, context);
    
    res.json(mergedContent);
  } catch (error: any) {
    console.error('Error merging template:', error);
    res.status(500).json({ error: 'Failed to merge template with data' });
  }
});

/**
 * Merge template with multiple properties
 * POST /api/email-templates/:templateId/mergeMultiple
 * Body: { buyer: BuyerData, propertyIds: string[] }
 */
router.post('/:templateId/mergeMultiple', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { buyer, propertyIds, templateSubject, templateBody } = req.body;

    if (!buyer) {
      return res.status(400).json({ error: 'Buyer data is required' });
    }
    if (!propertyIds || !Array.isArray(propertyIds)) {
      return res.status(400).json({ error: 'Property IDs array is required' });
    }

    // テンプレートデータをリクエストボディから受け取るか、Google Sheetsから取得する
    let template;
    if (templateSubject !== undefined && templateBody !== undefined) {
      // フロントエンドからテンプレートデータが渡された場合はそれを使用（Google Sheetsアクセス不要）
      template = {
        id: templateId,
        name: templateId,
        description: '',
        subject: templateSubject,
        body: templateBody,
        placeholders: [],
      };
    } else {
      template = await templateService.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
    }

    // Supabase から物件データを取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 物件番号で直接検索（propertyIdsは物件番号の配列）
    const { data: properties, error: propError } = await supabase
      .from('property_listings')
      .select('id, property_number, address, display_address, sales_price, price, google_map_url, suumo_url, property_type, land_area, building_area, current_status, viewing_key')
      .in('property_number', propertyIds);

    if (propError) {
      console.error('Error fetching properties:', propError);
      return res.status(500).json({ 
        error: 'Failed to fetch property data',
        detail: propError.message,
        propertyIds,
      });
    }

    const allProperties = properties || [];
    console.log(`[mergeMultiple] propertyIds=${JSON.stringify(propertyIds)}, found=${allProperties.length}`);
    if (allProperties.length > 0) {
      console.log(`[mergeMultiple] first property: current_status=${allProperties[0].current_status}, viewing_key=${allProperties[0].viewing_key}`);
    }
    if (allProperties.length === 0) {
      // 物件が見つからない場合でも、物件情報なしでテンプレートをマージして返す
      // follow_up_assignee でスタッフ情報を取得
      let staffInfoForMerge = null;
      const followUpAssignee = buyer.follow_up_assignee;
      if (followUpAssignee) {
        staffInfoForMerge = await staffService.getStaffByInitials(followUpAssignee);
        if (!staffInfoForMerge) {
          staffInfoForMerge = await staffService.getStaffByNameContains(followUpAssignee);
        }
      }
      let mergedContent = templateService.mergeMultipleProperties(template, buyer, []);
      mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
        mergedContent.subject, buyer, [], staffInfoForMerge
      );
      mergedContent.body = templateService.mergeAngleBracketPlaceholders(
        mergedContent.body, buyer, [], staffInfoForMerge
      );
      // FI物件判定（物件なしの場合もpropertyIdsで判定）
      const hasFIPropertyNoMatch = propertyIds.some((id: string) => id.toUpperCase().includes('FI'));
      if (hasFIPropertyNoMatch) {
        mergedContent.body = mergedContent.body.replace(
          /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n★非公開の情報はこちらから検索可能です↓↓\nhttps:\/\/property-site-frontend-kappa\.vercel\.app\/public\/properties/g,
          ''
        );
        mergedContent.body = mergedContent.body.replace(
          /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n★非公開の物件はこちらから↓↓\nhttps:\/\/property-site-frontend-kappa\.vercel\.app\/public\/properties\nお気軽にお問い合わせください。/g,
          ''
        );
        // 会社名を置換
        mergedContent.body = mergedContent.body.replace(/株式会社 いふう/g, '株式会社くじら不動産（株式会社いふう）');
        mergedContent.body = mergedContent.body.replace(/株式会社いふうと申します。/g, '株式会社くじら不動産と申します。');
        mergedContent.body = mergedContent.body.replace(/いふうにてお手伝い/g, 'くじら不動産にてお手伝い');
        mergedContent.subject = mergedContent.subject.replace(/株式会社いふう/g, '株式会社くじら不動産');
        // 署名の住所・TELを福岡用に置換
        mergedContent.body = mergedContent.body.replace(
          /〒870-0044\n?大分市舞鶴町1丁目3-30/g,
          '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201'
        );
        mergedContent.body = mergedContent.body.replace(
          /〒870-0044大分市舞鶴町1丁目3-30/g,
          '〒810-0073福岡市中央区舞鶴3-1-10オフィスニューガイアセレス赤坂門No.19 -201'
        );
        mergedContent.body = mergedContent.body.replace(/大分市舞鶴町1-3-30/g, '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201');
        mergedContent.body = mergedContent.body.replace(/TEL：097-533-2022/g, 'TEL：092-401-5331');
        mergedContent.body = mergedContent.body.replace(/TEL:097-533-2022/g, 'TEL:092-401-5331');
        mergedContent.body = mergedContent.body.replace(/097-533-2022/g, '092-401-5331');
      }
      // 業者問合せ判定: broker_inquiry === '業者問合せ' の場合、不要ブロックを削除
      if (buyer.broker_inquiry === '業者問合せ') {
        // ★大分市の新築建売専門サイト↓↓ とURLの行を、後続行に関わらず削除
        mergedContent.body = mergedContent.body.replace(
          /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n/g,
          '\n'
        );
        // ★★ 非公開情報配信中！！ ★★ ブロックを削除
        mergedContent.body = mergedContent.body.replace(
          /\n?★★ 非公開情報配信中！！ ★★\nメールで公開前の最新情報を優先的にご案内しております。物件探しにぜひご活用ください！\n配信希望／配信内容変更は こちら から（アンケートフォームに移動します）\nhttps:\/\/bit\.ly\/3TT9ZIH/g,
          ''
        );
      }
      return res.json(mergedContent);
    }

    // <<>> プレースホルダー用データ
    // 種別に"マ"が含まれる場合は住居表示（display_address）を優先する
    const propertyDataForPlaceholders = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      address: (p.property_type || '').includes('マ')
        ? (p.display_address || p.address || '')
        : (p.address || ''),
      price: p.price,
      googleMapUrl: p.google_map_url || '',
      athomeUrl: p.suumo_url || '',
      detailUrl: p.suumo_url || '',
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
      currentStatus: p.current_status || '',
      viewingKey: p.viewing_key || '',
    }));

    // {{}} 形式用データ（後方互換）
    // 種別に"マ"が含まれる場合は住居表示（display_address）を優先する
    const legacyProperties = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      propertyAddress: (p.property_type || '').includes('マ')
        ? (p.display_address || p.address || '')
        : (p.address || ''),
      price: p.sales_price || p.price || 0,
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // follow_up_assignee でスタッフ情報を取得
    let staffInfoForMerge = null;
    const followUpAssignee = buyer.follow_up_assignee;
    if (followUpAssignee) {
      staffInfoForMerge = await staffService.getStaffByInitials(followUpAssignee);
      if (!staffInfoForMerge) {
        staffInfoForMerge = await staffService.getStaffByNameContains(followUpAssignee);
      }
    }

    // {{}} 形式を置換してから <<>> 形式を置換
    let mergedContent = templateService.mergeMultipleProperties(template, buyer, legacyProperties);
    mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
      mergedContent.subject, buyer, propertyDataForPlaceholders, staffInfoForMerge
    );
    mergedContent.body = templateService.mergeAngleBracketPlaceholders(
      mergedContent.body, buyer, propertyDataForPlaceholders, staffInfoForMerge
    );

    // FI物件判定: 問合せ物件番号に「FI」が含まれる場合、建売専門サイトリンクを削除し署名を福岡用に置換
    const hasFIProperty = propertyIds.some((id: string) => id.toUpperCase().includes('FI'));
    if (hasFIProperty) {
      // ★大分市の新築建売専門サイト↓↓...お気軽にお問い合わせください。ブロックを削除
      mergedContent.body = mergedContent.body.replace(
        /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n★非公開の情報はこちらから検索可能です↓↓\nhttps:\/\/property-site-frontend-kappa\.vercel\.app\/public\/properties/g,
        ''
      );
      mergedContent.body = mergedContent.body.replace(
        /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n★非公開の物件はこちらから↓↓\nhttps:\/\/property-site-frontend-kappa\.vercel\.app\/public\/properties\nお気軽にお問い合わせください。/g,
        ''
      );
      // 会社名を置換: 株式会社 いふう / 株式会社いふう → 株式会社くじら不動産（株式会社いふう）
      mergedContent.body = mergedContent.body.replace(/株式会社 いふう/g, '株式会社くじら不動産（株式会社いふう）');
      mergedContent.body = mergedContent.body.replace(/株式会社いふうと申します。/g, '株式会社くじら不動産と申します。');
      mergedContent.body = mergedContent.body.replace(/いふうにてお手伝い/g, 'くじら不動産にてお手伝い');
      mergedContent.subject = mergedContent.subject.replace(/株式会社いふう/g, '株式会社くじら不動産');
      // 署名の住所・TELを福岡用に置換
      mergedContent.body = mergedContent.body.replace(
        /〒870-0044\n?大分市舞鶴町1丁目3-30/g,
        '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201'
      );
      mergedContent.body = mergedContent.body.replace(
        /〒870-0044大分市舞鶴町1丁目3-30/g,
        '〒810-0073福岡市中央区舞鶴3-1-10オフィスニューガイアセレス赤坂門No.19 -201'
      );
      mergedContent.body = mergedContent.body.replace(/大分市舞鶴町1-3-30/g, '〒810-0073福岡市中央区舞鶴3-1-10\nオフィスニューガイアセレス赤坂門No.19 -201');
      mergedContent.body = mergedContent.body.replace(/TEL：097-533-2022/g, 'TEL：092-401-5331');
      mergedContent.body = mergedContent.body.replace(/TEL:097-533-2022/g, 'TEL:092-401-5331');
      mergedContent.body = mergedContent.body.replace(/097-533-2022/g, '092-401-5331');
    }

    // 業者問合せ判定: broker_inquiry === '業者問合せ' の場合、不要ブロックを削除
    if (buyer.broker_inquiry === '業者問合せ') {
      // ★大分市の新築建売専門サイト↓↓ とURLの行を、後続行に関わらず削除
      mergedContent.body = mergedContent.body.replace(
        /\n?★大分市の新築建売専門サイト↓↓\nhttps:\/\/sateituikyaku-admin-frontend\.vercel\.app\/tateuri\n/g,
        '\n'
      );
      // ★★ 非公開情報配信中！！ ★★ ブロックを削除
      mergedContent.body = mergedContent.body.replace(
        /\n?★★ 非公開情報配信中！！ ★★\nメールで公開前の最新情報を優先的にご案内しております。物件探しにぜひご活用ください！\n配信希望／配信内容変更は こちら から（アンケートフォームに移動します）\nhttps:\/\/bit\.ly\/3TT9ZIH/g,
        ''
      );
    }

    res.json(mergedContent);
  } catch (error: any) {
    console.error('Error merging template with multiple properties:', error);
    res.status(500).json({ error: 'Failed to merge template with multiple properties' });
  }
});

export default router;
