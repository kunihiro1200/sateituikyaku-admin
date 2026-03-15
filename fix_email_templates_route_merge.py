#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""emailTemplates.ts に POST /api/email-templates/property/merge エンドポイントを追加"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read().decode('utf-8')

# import に StaffManagementService を追加
old_imports = """import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { TemplateContext } from '../types/emailTemplate';"""

new_imports = """import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { EmailTemplateService } from '../services/EmailTemplateService';
import { StaffManagementService } from '../services/StaffManagementService';
import { TemplateContext } from '../types/emailTemplate';"""

content = content.replace(old_imports, new_imports)

# templateService の後に staffService を追加
old_service_init = """const router = express.Router();
const templateService = new EmailTemplateService();"""

new_service_init = """const router = express.Router();
const templateService = new EmailTemplateService();
const staffService = new StaffManagementService();"""

content = content.replace(old_service_init, new_service_init)

# GET /property の後に POST /property/merge を追加
old_property_route = """router.get('/property', async (req, res) => {
  try {
    const templates = await templateService.getPropertyTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching property templates:', error);
    res.status(500).json({ error: 'Failed to fetch property templates', message: error.message });
  }
});"""

new_property_route = """router.get('/property', async (req, res) => {
  try {
    const templates = await templateService.getPropertyTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching property templates:', error);
    res.status(500).json({ error: 'Failed to fetch property templates', message: error.message });
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

    // 売主データを取得（seller_number = property_number）
    let sellerName = '';
    try {
      const { data: seller } = await supabase
        .from('sellers')
        .select('name')
        .eq('seller_number', propertyNumber)
        .single();
      if (seller?.name) {
        sellerName = seller.name;
      }
    } catch {
      // 売主が見つからない場合は空文字のまま
    }

    // スタッフ情報を取得（sales_assignee のイニシャルで検索）
    let staffInfo = null;
    const salesAssignee = property.sales_assignee;
    if (salesAssignee) {
      staffInfo = await staffService.getStaffByInitials(salesAssignee);
    }

    // プレースホルダー置換
    const mergedSubject = templateService.mergePropertyTemplate(
      template.subject,
      property,
      sellerName,
      staffInfo
    );
    const mergedBody = templateService.mergePropertyTemplate(
      template.body,
      property,
      sellerName,
      staffInfo
    );

    res.json({ subject: mergedSubject, body: mergedBody });
  } catch (error: any) {
    console.error('Error merging property template:', error);
    res.status(500).json({ error: 'Failed to merge property template', message: error.message });
  }
});"""

content = content.replace(old_property_route, new_property_route)

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done: emailTemplates.ts updated')
