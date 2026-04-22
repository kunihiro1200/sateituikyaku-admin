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
値下げ後、問合せが増えることが想定されますので、ご興味のある場合はお早めにご連絡ください。

お問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！

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
  },
  {
    id: 'private-email-only',
    name: '非公開案件メール配信',
    subject: '未公開物件のお知らせ＜{address}＞',
    body: `顧客様限定！【ネット非公開情報】のご案内

お世話になっております。
大分市舞鶴町の不動産会社『株式会社いふう』です。

物件住所：{address}
詳細URL:{publicUrl}

内覧は可能ですので、こちらのメールに
■名前
■電話番号
■メールアドレス
■内覧希望日時
■その他ご質問
を入力して返信して頂ければと思います。

＼＼お問い合わせはこちら／／
電話：097-533-2022（10～18時）
メール：tenant@ifoo-oita.com
お電話の際は、物件名・価格と「非公開メールを見て」とお伝えいただくとスムーズです。
メールは24時間受け付けております。

***************************
株式会社 いふう
〒870-0044
大分市舞鶴町1丁目3-30
TEL：097-533-2022
FAX：097-529-7160
HP：https://ifoo-oita.com/
店休日：毎週水曜日　年末年始、GW、盆
***************************`,
    placeholders: ['address', 'publicUrl']
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
