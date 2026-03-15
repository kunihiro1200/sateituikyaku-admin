import { EmailTemplate, TemplateContext, MergedEmailContent, PropertyData, BuyerData } from '../types/emailTemplate';
import { GoogleSheetsClient } from './GoogleSheetsClient';

const TEMPLATE_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';
const TEMPLATE_SHEET_NAME = '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8';

/**
 * Service for managing email templates and merging them with data
 * \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306f\u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u304b\u3089\u52d5\u7684\u306b\u53d6\u5f97\u3059\u308b
 * C\u5217=\u533a\u5206, D\u5217=\u7a2e\u5225\uff08\u30bf\u30a4\u30c8\u30eb\uff09, E\u5217=\u4ef6\u540d, F\u5217=\u672c\u6587
 */
export class EmailTemplateService {
  /**
   * \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u304b\u3089\u8cb7\u4e3b\u7528\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u53d6\u5f97
   */
  async getTemplates(): Promise<EmailTemplate[]> {
    try {
      const client = new GoogleSheetsClient({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        sheetName: TEMPLATE_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      });
      await client.authenticate();

      // C\uff5eF\u5217\u3092\u53d6\u5f97\uff081\u884c\u76ee\u306f\u30d8\u30c3\u30c0\u30fc\uff09
      const sheetsInstance = (client as any).sheets;
      const response = await sheetsInstance.spreadsheets.values.get({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        range: `${TEMPLATE_SHEET_NAME}!C:F`,
      });

      const rows: any[][] = response.data.values || [];
      const templates: EmailTemplate[] = [];

      // 1\u884c\u76ee\u306f\u30d8\u30c3\u30c0\u30fc\u306a\u306e\u3067\u30b9\u30ad\u30c3\u30d7
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[0] || '').toString().trim(); // C\u5217: \u533a\u5206
        const type = (row[1] || '').toString().trim();     // D\u5217: \u7a2e\u5225\uff08\u30bf\u30a4\u30c8\u30eb\uff09
        const subject = (row[2] || '').toString().trim();  // E\u5217: \u4ef6\u540d
        const body = (row[3] || '').toString().trim();     // F\u5217: \u672c\u6587

        // \u533a\u5206\u304c\u300c\u8cb7\u4e3b\u300d\u306e\u884c\u306e\u307f\u5bfe\u8c61
        if (category !== '\u8cb7\u4e3b' || !type) continue;

        templates.push({
          id: `buyer_sheet_${i}`,
          name: type,
          description: type,
          subject,
          body,
          placeholders: [],
        });
      }

      console.log(`[EmailTemplateService] \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u304b\u3089${templates.length}\u4ef6\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u53d6\u5f97\u3057\u307e\u3057\u305f`);
      return templates;
    } catch (error: any) {
      console.error('[EmailTemplateService] \u30b9\u30d7\u30ec\u30c3\u30c9\u30b7\u30fc\u30c8\u304b\u3089\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u53d6\u5f97\u306b\u5931\u6557:', error.message);
      throw error;
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
   * スプレッドシートから物件用テンプレートを取得（区分=「物件」）
   */
  async getPropertyTemplates(): Promise<EmailTemplate[]> {
    try {
      const client = new GoogleSheetsClient({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        sheetName: TEMPLATE_SHEET_NAME,
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      });
      await client.authenticate();

      const sheetsInstance = (client as any).sheets;
      const response = await sheetsInstance.spreadsheets.values.get({
        spreadsheetId: TEMPLATE_SPREADSHEET_ID,
        range: `${TEMPLATE_SHEET_NAME}!C:F`,
      });

      const rows: any[][] = response.data.values || [];
      const templates: EmailTemplate[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[0] || '').toString().trim();
        const type = (row[1] || '').toString().trim();
        const subject = (row[2] || '').toString().trim();
        const body = (row[3] || '').toString().trim();

        if (category !== '物件' || !type) continue;

        templates.push({
          id: `property_sheet_${i}`,
          name: type,
          description: type,
          subject,
          body,
          placeholders: [],
        });
      }

      console.log(`[EmailTemplateService] 物件テンプレート ${templates.length}件取得`);
      return templates;
    } catch (error: any) {
      console.error('[EmailTemplateService] 物件テンプレート取得失敗:', error.message);
      throw error;
    }
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
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      subject = subject.replace(new RegExp(escaped, 'g'), replacement);
      body = body.replace(new RegExp(escaped, 'g'), replacement);
    }

    return { subject, body };
  }

  private createDataMap(context: TemplateContext): Record<string, any> {
    const dataMap: Record<string, any> = {};

    if (context.buyer) {
      dataMap['buyerName'] = context.buyer.buyerName;
      dataMap['email'] = context.buyer.email;
      for (const [key, value] of Object.entries(context.buyer)) {
        if (key !== 'buyerName' && key !== 'email') dataMap[key] = value;
      }
    }

    if (context.property) {
      dataMap['propertyNumber'] = context.property.propertyNumber;
      dataMap['propertyAddress'] = context.property.propertyAddress;
      dataMap['price'] = context.property.price;
      for (const [key, value] of Object.entries(context.property)) {
        if (!['propertyNumber', 'propertyAddress', 'price'].includes(key)) dataMap[key] = value;
      }
    }

    for (const [key, value] of Object.entries(context)) {
      if (key !== 'buyer' && key !== 'property') dataMap[key] = value;
    }

    return dataMap;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toLocaleString('ja-JP');
    if (value instanceof Date) return value.toLocaleDateString('ja-JP');
    return String(value);
  }

  validatePlaceholders(template: EmailTemplate, context: TemplateContext): string[] {
    const dataMap = this.createDataMap(context);
    const missing: string[] = [];
    for (const placeholder of (template.placeholders || [])) {
      const key = placeholder.replace(/{{|}}/g, '');
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
      buyer: { buyerName: '\u5c71\u7530\u592a\u90ce', email: 'sample@example.com' },
      property: {
        propertyNumber: 'AA12345',
        propertyAddress: '\u5927\u5206\u770c\u5927\u5206\u5e02\u4e2d\u592e\u753a1-2-3',
        price: 35000000,
        landArea: 150.5,
        buildingArea: 95.2,
        propertyType: '\u6238\u5efa\u3066'
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
      const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      subject = subject.replace(new RegExp(escaped, 'g'), replacement);
      body = body.replace(new RegExp(escaped, 'g'), replacement);
    }

    const propertiesSection = properties.map((property, index) => {
      return [
        `\u3010\u7269\u4ef6${index + 1}\u3011`,
        `\u7269\u4ef6\u756a\u53f7: ${property.propertyNumber}`,
        `\u6240\u5728\u5730: ${property.propertyAddress}`,
        `\u4fa1\u683c: ${this.formatValue(property.price)}\u5186`,
        property.propertyType ? `\u7269\u4ef6\u7a2e\u5225: ${property.propertyType}` : '',
        property.landArea ? `\u571f\u5730\u9762\u7a4d: ${property.landArea}\u33a1` : '',
        property.buildingArea ? `\u5efa\u7269\u9762\u7a4d: ${property.buildingArea}\u33a1` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    if (body.includes('{{propertyNumber}}') || body.includes('{{propertyAddress}}')) {
      body = body.replace(/{{propertyNumber}}[\s\S]*?(?={{|$)/g, propertiesSection);
      body = body.replace(/{{propertyAddress}}/g, '');
      body = body.replace(/{{price}}/g, '');
      body = body.replace(/{{propertyType}}/g, '');
      body = body.replace(/{{landArea}}/g, '');
      body = body.replace(/{{buildingArea}}/g, '');
    } else {
      body += '\n\n' + propertiesSection;
    }

    return { subject, body };
  }

  /**
   * <<>> 形式のプレースホルダーを実際のデータで置換する
   * 例: <<住居表示>> → 物件住所, <<●氏名・会社名>> → 買主名
   */
  mergeAngleBracketPlaceholders(
    text: string,
    buyer: { name?: string; company_name?: string; buyer_number?: string; email?: string; [key: string]: any },
    properties: Array<{
      propertyNumber: string;
      address: string;
      price?: number;
      googleMapUrl?: string;
      athomeUrl?: string;
      detailUrl?: string;
      [key: string]: any;
    }>
  ): string {
    let result = text;

    // 買主情報の置換
    const buyerName = buyer.company_name
      ? `${buyer.name || ''}・${buyer.company_name}`
      : (buyer.name || buyer.buyerName || '');
    result = result.replace(/<<●氏名・会社名>>/g, buyerName);
    result = result.replace(/<<氏名>>/g, buyer.name || buyer.buyerName || '');
    result = result.replace(/<<買主番号>>/g, buyer.buyer_number || '');
    result = result.replace(/<<メールアドレス>>/g, buyer.email || '');

    if (properties.length === 0) return result;

    if (properties.length === 1) {
      const prop = properties[0];
      result = result.replace(/<<住居表示>>/g, prop.address || '');
      result = result.replace(/<<GoogleMap>>/g, prop.googleMapUrl ? `Googleマップ: ${prop.googleMapUrl}` : '');
      result = result.replace(/<<athome URL>>/g, prop.athomeUrl || '');
      result = result.replace(/<<物件詳細URL>>/g, prop.detailUrl || prop.athomeUrl || '');
    } else {
      const addressList = properties.map((p, i) => `【物件${i + 1}】${p.address || ''}`).join('\n');
      const mapList = properties.filter(p => p.googleMapUrl).map((p, i) => `【物件${i + 1}】Googleマップ: ${p.googleMapUrl}`).join('\n');
      const athomeList = properties.filter(p => p.athomeUrl).map(p => p.athomeUrl).join('\n');
      const detailList = properties.map(p => p.detailUrl || p.athomeUrl || '').filter(Boolean).join('\n');
      result = result.replace(/<<住居表示>>/g, addressList);
      result = result.replace(/<<GoogleMap>>/g, mapList ? `Googleマップ:\n${mapList}` : '');
      result = result.replace(/<<athome URL>>/g, athomeList);
      result = result.replace(/<<物件詳細URL>>/g, detailList);
    }

    // 未置換のプレースホルダーを空文字に
    result = result.replace(/<<SUUMO　URLの表示>>/g, '');
    result = result.replace(/<<内覧前伝達事項v>>/g, '');

    return result;
  }

  /**
   * 物件報告メール用プレースホルダー置換
   * <<●所有者情報>> → 売主氏名 + 様
   * <<担当名（営業）名前>> → sales_assignee
   * <<担当名（営業）電話番号/メールアドレス/固定休>> → スタッフ情報
   * その他 <<XXX>> → property_listings の対応カラム値
   */
  mergePropertyTemplate(
    text: string,
    property: Record<string, any>,
    sellerName: string,
    staffInfo: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null
  ): string {
    let result = text;

    // <<●所有者情報>> → 売主氏名 + 様
    result = result.replace(/<<●所有者情報>>/g, sellerName ? `${sellerName}様` : '');

    // <<担当名（営業）名前>> → sales_assignee
    result = result.replace(/<<担当名（営業）名前>>/g, property['sales_assignee'] || '');

    // <<担当名（営業）電話番号/メールアドレス/固定休>> → スタッフ情報
    result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
    result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
    result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');

    // その他 <<XXX>> → property_listings の対応カラム値
    result = result.replace(/<<([^>]+)>>/g, (_match: string, key: string) => {
      const trimmedKey = key.trim();
      if (property[trimmedKey] !== undefined && property[trimmedKey] !== null) {
        return String(property[trimmedKey]);
      }
      return '';
    });

    return result;
  }
}
