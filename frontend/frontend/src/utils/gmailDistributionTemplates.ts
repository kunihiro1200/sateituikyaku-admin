// Gmail配信用のメールテンプレート定義

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  placeholders: string[];
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'price-reduction',
    name: '値下げメール配信',
    subject: '【価格変更】{address}',
    body: `{buyerName}様
お世話になっております。

{address}の物件価格が変更となりました。

{priceChangeText}

詳細：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。

{signature}`,
    placeholders: ['address', 'propertyNumber', 'publicUrl', 'priceChangeText', 'buyerName', 'signature']
  },
  {
    id: 'new-listing',
    name: '新着物件配信',
    subject: '【新着物件】{address}',
    body: `{buyerName}様
いつもお世話になっております。
新着物件のご案内です。

物件住所: {address}
種別：{propertyType}
価格：{price}
詳細情報：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。

{signature}`,
    placeholders: ['address', 'propertyNumber', 'publicUrl', 'buyerName', 'propertyType', 'price', 'signature']
  },
  {
    id: 'pre-listing',
    name: '公開前配信',
    subject: '【未発表物件】{address}',
    body: `{buyerName}様
未発表の物件のご案内です。

物件住所: {address}
種別：{propertyType}
価格：{price}
詳細情報：{publicUrl}

詳細はお問い合わせください。

よろしくお願いいたします。

{signature}`,
    placeholders: ['address', 'propertyNumber', 'publicUrl', 'buyerName', 'propertyType', 'price', 'signature']
  }
];

/**
 * テンプレート内のプレースホルダーを実際の値に置換
 * @param template テンプレート文字列
 * @param data 置換データ
 * @returns 置換後の文字列
 */
export function replacePlaceholders(
  template: string,
  data: Record<string, string>
): string {
  let result = template;
  
  Object.entries(data).forEach(([key, value]) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{${escaped}\\}`, 'g'), value || '');
  });
  
  return result;
}

/**
 * IDからテンプレートを取得
 * @param id テンプレートID
 * @returns テンプレート、または見つからない場合はundefined
 */
export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id);
}

/**
 * すべてのテンプレートを取得
 * @returns テンプレート配列
 */
export function getAllTemplates(): EmailTemplate[] {
  return [...EMAIL_TEMPLATES];
}
