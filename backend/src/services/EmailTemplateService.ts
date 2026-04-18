import { EmailTemplate, TemplateContext, MergedEmailContent, PropertyData, BuyerData } from '../types/emailTemplate';
import { GoogleSheetsClient } from './GoogleSheetsClient';

const TEMPLATE_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';
const TEMPLATE_SHEET_NAME = 'テンプレート';

// インメモリキャッシュ（24時間TTL）
let _templatesCache: { data: EmailTemplate[]; expiresAt: number } | null = null;
const TEMPLATES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

/**
 * Service for managing email templates and merging them with data
 * テンプレートはスプレッドシートから動的に取得する
 * C列=区分, D列=種別（タイトル）, E列=件名, F列=本文
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
   * スプレッドシートから売主用テンプレートを取得（区分=「売主」）
   */
  async getSellerTemplates(): Promise<EmailTemplate[]> {
    // キャッシュチェック
    if (_templatesCache && Date.now() < _templatesCache.expiresAt) {
      console.log('[EmailTemplateService] キャッシュから売主テンプレートを返します');
      return _templatesCache.data.filter(t => t.id.startsWith('seller_'));
    }

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
      const allTemplates: EmailTemplate[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[0] || '').toString().trim();
        const type = (row[1] || '').toString().trim();
        const subject = (row[2] || '').toString().trim();
        const body = (row[3] || '').toString().trim();

        if (!type) continue;

        const idPrefix = category === '売主' ? 'seller' : category === '物件' ? 'property' : category === '買主' ? 'buyer' : 'other';
        allTemplates.push({
          id: `${idPrefix}_sheet_${i}`,
          name: type,
          description: type,
          subject,
          body,
          placeholders: [],
        });
      }

      // キャッシュに保存
      _templatesCache = {
        data: allTemplates,
        expiresAt: Date.now() + TEMPLATES_CACHE_TTL_MS,
      };

      const sellerTemplates = allTemplates.filter(t => t.id.startsWith('seller_'));
      console.log(`[EmailTemplateService] 売主テンプレート ${sellerTemplates.length}件取得（キャッシュ更新）`);

      // 指定順序でソート
      const SELLER_TEMPLATE_ORDER = [
        '査定額案内メール',
        '不通で電話時間確認',
        'キャンセル案内のみ',
        '住替え先',
        '相続（３日後',
        '離婚',
        'ローン厳しい',
        '除外前',
        'リマインド',
        'WEB打合せ',
        '訪問前日',
        '訪問査定後御礼',
        '相続登記',
        '他決になった理由',
        '他決→追客（3ヶ月',
        '他決→追客（6ヶ月',
      ];

      sellerTemplates.sort((a, b) => {
        const aIdx = SELLER_TEMPLATE_ORDER.findIndex(keyword => a.name.includes(keyword));
        const bIdx = SELLER_TEMPLATE_ORDER.findIndex(keyword => b.name.includes(keyword));
        const aOrder = aIdx === -1 ? 999 : aIdx;
        const bOrder = bIdx === -1 ? 999 : bIdx;
        return aOrder - bOrder;
      });

      return sellerTemplates;
    } catch (error: any) {
      console.error('[EmailTemplateService] 売主テンプレート取得失敗:', error.message);
      throw error;
    }
  }

  /**
   * スプレッドシートから物件用テンプレートを取得（区分=「物件」かつ種別に「報告」を含まないもの）
   * 物件詳細画面のEmail送信ボタン向け
   */
  async getPropertyNonReportTemplates(): Promise<EmailTemplate[]> {
    // キャッシュがあればそこから返す（getSellerTemplates と共有キャッシュ）
    if (_templatesCache && Date.now() < _templatesCache.expiresAt) {
      console.log('[EmailTemplateService] キャッシュから物件（非報告）テンプレートを返します');
      return _templatesCache.data.filter(t => t.id.startsWith('property_') && !t.name.includes('報告'));
    }
    // キャッシュがない場合は getSellerTemplates を呼んでキャッシュを作成してから返す
    await this.getSellerTemplates();
    return (_templatesCache?.data || []).filter(t => t.id.startsWith('property_') && !t.name.includes('報告'));
  }

  /**
   * スプレッドシートから物件用テンプレートを取得（区分=「物件」）
   */
  async getPropertyTemplates(): Promise<EmailTemplate[]> {
    // キャッシュがあればそこから返す（getSellerTemplates と共有キャッシュ）
    if (_templatesCache && Date.now() < _templatesCache.expiresAt) {
      console.log('[EmailTemplateService] キャッシュから物件テンプレートを返します');
      return _templatesCache.data.filter(t => t.id.startsWith('property_'));
    }
    // キャッシュがない場合は getSellerTemplates を呼んでキャッシュを作成してから返す
    await this.getSellerTemplates();
    return (_templatesCache?.data || []).filter(t => t.id.startsWith('property_'));
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
    }
    // プレースホルダーがない場合は物件情報を末尾に追加しない

    return { subject, body };
  }

  /**
   * <<>> 形式のプレースホルダーを実際のデータで置換する
   * 例: <<住居表示>> → 物件住所, <<●氏名・会社名>> → 買主名
   */
  mergeAngleBracketPlaceholders(
    text: string,
    buyer: { name?: string; company_name?: string; buyer_number?: string; email?: string; pre_viewing_notes?: string; [key: string]: any },
    properties: Array<{
      propertyNumber: string;
      address: string;
      price?: number;
      googleMapUrl?: string;
      athomeUrl?: string;
      detailUrl?: string;
      [key: string]: any;
    }>,
    staffInfo?: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null
  ): string {
    let result = text;

    // 買主情報の置換
    const isBrokerInquiry = buyer.broker_inquiry === '業者問合せ';
    const buyerName = (!isBrokerInquiry && buyer.company_name)
      ? `${buyer.name || ''}・${buyer.company_name}`
      : (buyer.name || buyer.buyerName || '');
    result = result.replace(/<<●氏名・会社名>>/g, buyerName);
    result = result.replace(/<<氏名>>/g, buyer.name || buyer.buyerName || '');
    result = result.replace(/<<買主番号>>/g, buyer.buyer_number || '');
    result = result.replace(/<<メールアドレス>>/g, buyer.email || '');

    if (properties.length === 0) {
      // 物件なしの場合、物件関連プレースホルダーを空文字に置換
      result = result.replace(/<<住居表示>>/g, '');
      result = result.replace(/<<住居表示Pinrich>>/g, '');
      result = result.replace(/<<GoogleMap>>/g, '');
      result = result.replace(/<<athome URL>>/g, '');
      result = result.replace(/<<物件詳細URL>>/g, '');
      result = result.replace(/<<SUUMO　URLの表示>>/g, '');
      result = result.replace(/<<SUUMO URL>>/g, '');
      result = result.replace(/<<内覧前伝達事項v>>/g, buyer.pre_viewing_notes || '');
      // 内覧日・時間の置換
      const latestViewingDate0 = buyer.latest_viewing_date || buyer.latestViewingDate || '';
      const viewingTime0 = buyer.viewing_time || buyer.viewingTime || '';
      let formattedDate0 = latestViewingDate0;
      if (latestViewingDate0) {
        const dateMatch0 = latestViewingDate0.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (dateMatch0) formattedDate0 = `${parseInt(dateMatch0[2])}月${parseInt(dateMatch0[3])}日`;
      }
      let formattedTime0 = viewingTime0;
      if (viewingTime0) {
        const timeMatch0 = viewingTime0.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch0) formattedTime0 = `${parseInt(timeMatch0[1])}時${timeMatch0[2]}分`;
      }
      result = result.replace(/<<内覧日>>/g, formattedDate0);
      result = result.replace(/<<時間>>/g, formattedTime0);
      result = result.replace(/<<内覧アンケート>>/g, '');
      // <<担当名（営業）>> 系プレースホルダーの置換（staffInfo が渡された場合）
      result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || '');
      result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
      result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
      result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');
      result = result.replace(/<<[^>]*>>/g, '');
      return result;
    }

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

    // 内覧アンケートURLを生成して置換
    // フォーマット: ベースURL + 買主番号 + 物件住所
    const viewingFormBase = 'https://docs.google.com/forms/d/e/1FAIpQLSefXwsYKryraVM4jtnLgcYtboUg3w-lx7tasftVA47E5jXUlQ/viewform?usp=pp_url';
    const firstAddress = properties.length > 0 ? (properties[0].address || '') : '';
    const viewingFormUrl = `${viewingFormBase}&entry.267319544=${buyer.buyer_number || ''}&entry.2056434590=${encodeURIComponent(firstAddress)}`;
    result = result.replace(/<<内覧アンケート>>/g, viewingFormUrl);

    // 未置換のプレースホルダーを空文字に
    result = result.replace(/<<SUUMO　URLの表示>>/g, '');
    result = result.replace(/<<SUUMO URL>>/g, '');
    result = result.replace(/<<内覧前伝達事項v>>/g, buyer.pre_viewing_notes || '');

    // 内覧日・時間の置換（フォーマット変換）
    const latestViewingDate = buyer.latest_viewing_date || buyer.latestViewingDate || '';
    const viewingTime = buyer.viewing_time || buyer.viewingTime || '';

    // 内覧日を「●月●日」形式に変換
    let formattedDate = latestViewingDate;
    if (latestViewingDate) {
      // "2026/3/30" or "2026-03-30" or ISO形式に対応
      const dateMatch = latestViewingDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        formattedDate = `${parseInt(dateMatch[2])}月${parseInt(dateMatch[3])}日`;
      }
    }

    // 時間を「〇〇時〇〇分」形式に変換
    let formattedTime = viewingTime;
    if (viewingTime) {
      // "14:00" or "14:00:00" 形式に対応
      const timeMatch = viewingTime.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        formattedTime = `${parseInt(timeMatch[1])}時${timeMatch[2]}分`;
      }
    }

    result = result.replace(/<<内覧日>>/g, formattedDate);
    result = result.replace(/<<時間>>/g, formattedTime);

    // <<住居表示Pinrich>> の置換（空欄の場合は非表示）
    const pinrichUrl = buyer.pinrich_url || buyer.pinrichUrl || '';
    result = result.replace(/<<住居表示Pinrich>>/g, pinrichUrl || '');

    // <<担当名（営業）>> 系プレースホルダーの置換（staffInfo が渡された場合）
    result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || '');
    result = result.replace(/<<担当名（営業）電話番号>>/g, staffInfo?.phone || '');
    result = result.replace(/<<担当名（営業）メールアドレス>>/g, staffInfo?.email || '');
    result = result.replace(/<<担当名（営業）固定休>>/g, staffInfo?.regularHoliday || '');

    // 残った未置換の <<...>> を空文字に（安全策）
    result = result.replace(/<<[^>]*>>/g, '');

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

    // <<住居表示（ATBB登録住所）>> → address または display_address
    const propertyAddress = property['address'] || property['display_address'] || '';
    result = result.replace(/<<住居表示（ATBB登録住所）>>/g, propertyAddress);

    // <<担当名（営業）名前>> → staffInfo.name（姓名）
    result = result.replace(/<<担当名（営業）名前>>/g, staffInfo?.name || property['sales_assignee'] || '');

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
