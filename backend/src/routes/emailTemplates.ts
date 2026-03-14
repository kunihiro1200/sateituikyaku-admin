import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { TemplateContext } from '../types/emailTemplate';

const router = express.Router();
const templateService = new EmailTemplateService();

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
    const { buyer, propertyIds } = req.body;

    if (!buyer) {
      return res.status(400).json({ error: 'Buyer data is required' });
    }
    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'Property IDs array is required' });
    }

    const template = await templateService.getTemplateById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Supabase から物件データを取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
    );

    // 物件番号で直接検索（propertyIdsは物件番号の配列）
    const { data: properties, error: propError } = await supabase
      .from('property_listings')
      .select('id, property_number, address, sales_price, price, google_map_url, suumo_url, property_type, land_area, building_area')
      .in('property_number', propertyIds);

    if (propError) {
      console.error('Error fetching properties:', propError);
      return res.status(500).json({ error: 'Failed to fetch property data' });
    }

    const allProperties = properties || [];
    if (allProperties.length === 0) {
      return res.status(404).json({ error: 'No valid properties found' });
    }

    // <<>> プレースホルダー用データ
    const propertyDataForPlaceholders = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      address: p.address || '',
      price: p.price,
      googleMapUrl: p.google_map_url || '',
      athomeUrl: p.suumo_url || '',
      detailUrl: p.suumo_url || '',
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // {{}} 形式用データ（後方互換）
    const legacyProperties = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      propertyAddress: p.address || '',
      price: p.sales_price || p.price || 0,
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // {{}} 形式を置換してから <<>> 形式を置換
    let mergedContent = templateService.mergeMultipleProperties(template, buyer, legacyProperties);
    mergedContent.subject = templateService.mergeAngleBracketPlaceholders(
      mergedContent.subject, buyer, propertyDataForPlaceholders
    );
    mergedContent.body = templateService.mergeAngleBracketPlaceholders(
      mergedContent.body, buyer, propertyDataForPlaceholders
    );

    res.json(mergedContent);
  } catch (error: any) {
    console.error('Error merging template with multiple properties:', error);
    res.status(500).json({ error: 'Failed to merge template with multiple properties' });
  }
});

export default router;
