#!/usr/bin/env python3
# EmailTemplateServiceをスプレッドシートから動的取得するように修正

new_content = '''import { EmailTemplate, TemplateContext, MergedEmailContent, PropertyData, BuyerData } from '../types/emailTemplate';
import { GoogleSheetsClient } from './GoogleSheetsClient';

const TEMPLATE_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';
const TEMPLATE_SHEET_NAME = 'テンプレート';

/**
 * Service for managing email templates and merging them with data
 * テンプレートはスプレッドシートから動的に取得する
 * C列=区分, D列=種別（タイトル）, E列=件名, F列=本文
 */
export class EmailTemplateService {
  /**
   * スプレッドシートから買主用テンプレートを取得
   */
  async getTemplates(): Promise<EmailTemplate[]> {
    try {
      const client = new GoogleSheetsClient({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        sheetName: TEMPLATE_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      });
      await client.authenticate();

      // C〜F列を取得（1行目はヘッダー）
      const sheetsInstance = (client as any).sheets;
      const response = await sheetsInstance.spreadsheets.values.get({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        range: `${TEMPLATE_SHEET_NAME}!C:F`,
      });

      const rows: any[][] = response.data.values || [];
      const templates: EmailTemplate[] = [];

      // 1行目はヘッダーなのでスキップ
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[0] || '').toString().trim(); // C列: 区分
        const type = (row[1] || '').toString().trim();     // D列: 種別（タイトル）
        const subject = (row[2] || '').toString().trim();  // E列: 件名
        const body = (row[3] || '').toString().trim();     // F列: 本文

        // 区分が「買主」の行のみ対象
        if (category !== '買主' || !type) continue;

        templates.push({
          id: `buyer_sheet_${i}`,
          name: type,
          description: type,
          subject,
          body,
          placeholders: [],
        });
      }

      console.log(`[EmailTemplateService] スプレッドシートから${templates.length}件のテンプレートを取得しました`);
      return templates;
    } catch (error: any) {
      console.error('[EmailTemplateService] スプレッドシートからのテンプレート取得に失敗:', error.message);
      // フォールバック: 空配列を返す
      return [];
    }
  }

  /**
   * Get a specific template by ID
   */
  async getTemplateById(templateId: string): Promise<EmailTemplate | null> {
    const templates = await this.getTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  /**
   * Merge template placeholders with actual data
   */
  mergePlaceholders(template: EmailTemplate, context: TemplateContext): MergedEmailContent {
    let subject = template.subject;
    let body = template.body;

    const dataMap = this.createDataMap(context);

    for (const [key, value] of Object.entries(dataMap)) {
      const placeholder = `{{${key}}}`;
      const replacement = this.formatValue(value);
      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\'), \'g\'), replacement);
      body = body.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\'), \'g\'), replacement);
    }

    return { subject, body };
  }

  private createDataMap(context: TemplateContext): Record<string, any> {
    const dataMap: Record<string, any> = {};

    if (context.buyer) {
      dataMap[\'buyerName\'] = context.buyer.buyerName;
      dataMap[\'email\'] = context.buyer.email;
      for (const [key, value] of Object.entries(context.buyer)) {
        if (key !== \'buyerName\' && key !== \'email\') dataMap[key] = value;
      }
    }

    if (context.property) {
      dataMap[\'propertyNumber\'] = context.property.propertyNumber;
      dataMap[\'propertyAddress\'] = context.property.propertyAddress;
      dataMap[\'price\'] = context.property.price;
      for (const [key, value] of Object.entries(context.property)) {
        if (![\'propertyNumber\', \'propertyAddress\', \'price\'].includes(key)) dataMap[key] = value;
      }
    }

    for (const [key, value] of Object.entries(context)) {
      if (key !== \'buyer\' && key !== \'property\') dataMap[key] = value;
    }

    return dataMap;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return \'\';
    if (typeof value === \'number\') return value.toLocaleString(\'ja-JP\');
    if (value instanceof Date) return value.toLocaleDateString(\'ja-JP\');
    return String(value);
  }

  validatePlaceholders(template: EmailTemplate, context: TemplateContext): string[] {
    const dataMap = this.createDataMap(context);
    const missing: string[] = [];
    for (const placeholder of (template.placeholders || [])) {
      const key = placeholder.replace(/{{|}}/g, \'\');
      if (!(key in dataMap) || dataMap[key] === null || dataMap[key] === undefined) {
        missing.push(placeholder);
      }
    }
    return missing;
  }

  async getTemplatePreview(templateId: string): Promise<MergedEmailContent | null> {
    const template = await this.getTemplateById(templateId);
    if (!template) return null;

    const sampleContext: TemplateContext = {
      buyer: { buyerName: \'山田太郎\', email: \'sample@example.com\' },
      property: {
        propertyNumber: \'AA12345\',
        propertyAddress: \'大分県大分市中央町1-2-3\',
        price: 35000000,
        landArea: 150.5,
        buildingArea: 95.2,
        propertyType: \'戸建て\'
      }
    };

    return this.mergePlaceholders(template, sampleContext);
  }

  mergeMultipleProperties(template: EmailTemplate, buyer: BuyerData, properties: PropertyData[]): MergedEmailContent {
    let subject = template.subject;
    let body = template.body;

    const buyerMap: Record<string, any> = { buyerName: buyer.buyerName, email: buyer.email, ...buyer };
    for (const [key, value] of Object.entries(buyerMap)) {
      const placeholder = `{{${key}}}`;
      const replacement = this.formatValue(value);
      subject = subject.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\'), \'g\'), replacement);
      body = body.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\\]\\\\]/g, \'\\\\$&\'), \'g\'), replacement);
    }

    const propertiesSection = properties.map((property, index) => {
      return [
        `【物件${index + 1}】`,
        `物件番号: ${property.propertyNumber}`,
        `所在地: ${property.propertyAddress}`,
        `価格: ${this.formatValue(property.price)}円`,
        property.propertyType ? `物件種別: ${property.propertyType}` : \'\',
        property.landArea ? `土地面積: ${property.landArea}㎡` : \'\',
        property.buildingArea ? `建物面積: ${property.buildingArea}㎡` : \'\',
      ].filter(Boolean).join(\'\\n\');
    }).join(\'\\n\\n\');

    if (body.includes(\'{{propertyNumber}}\') || body.includes(\'{{propertyAddress}}\')) {
      body = body.replace(/{{propertyNumber}}[\\s\\S]*?(?={{|$)/g, propertiesSection);
      body = body.replace(/{{propertyAddress}}/g, \'\');
      body = body.replace(/{{price}}/g, \'\');
      body = body.replace(/{{propertyType}}/g, \'\');
      body = body.replace(/{{landArea}}/g, \'\');
      body = body.replace(/{{buildingArea}}/g, \'\');
    } else {
      body += \'\\n\\n\' + propertiesSection;
    }

    return { subject, body };
  }
}
'''

with open('backend/src/services/EmailTemplateService.ts', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print('✅ EmailTemplateService.ts を更新しました')
