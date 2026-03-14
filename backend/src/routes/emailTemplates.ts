import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { TemplateContext } from '../types/emailTemplate';

const router = express.Router();
const templateService = new EmailTemplateService();

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
    res.status(500).json({ error: 'Failed to fetch email templates' });
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
 * POST /api/email-templates/:templateId/merge-multiple
 * Body: { buyer: BuyerData, propertyIds: string[] }
 */
router.post('/:templateId/merge-multiple', async (req, res) => {
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

    // UUID で検索
    const { data: propertiesById } = await supabase
      .from('property_listings')
      .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
      .in('id', propertyIds);

    const foundIds = new Set((propertiesById || []).map((p: any) => p.id));
    const missingIds = propertyIds.filter((id: string) => !foundIds.has(id));

    // 見つからなかった分は property_number で検索
    let propertiesByNumber: any[] = [];
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from('property_listings')
        .select('id, property_number, address, price, google_map_url, athome_url, property_type, land_area, building_area')
        .in('property_number', missingIds);
      propertiesByNumber = data || [];
    }

    const allProperties = [...(propertiesById || []), ...propertiesByNumber];
    if (allProperties.length === 0) {
      return res.status(404).json({ error: 'No valid properties found' });
    }

    // <<>> プレースホルダー用データ
    const propertyDataForPlaceholders = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      address: p.address || '',
      price: p.price,
      googleMapUrl: p.google_map_url || '',
      athomeUrl: p.athome_url || '',
      detailUrl: p.athome_url || '',
      propertyType: p.property_type || '',
      landArea: p.land_area,
      buildingArea: p.building_area,
    }));

    // {{}} 形式用データ（後方互換）
    const legacyProperties = allProperties.map((p: any) => ({
      propertyNumber: p.property_number || '',
      propertyAddress: p.address || '',
      price: p.price || 0,
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
