/**
 * 物件詳細画面SMS送信テンプレート定義
 * PropertyListingDetailPage で使用するSMSテンプレートと本文生成ロジック
 */

export type SmsTemplateId = 'viewing_inquiry' | 'empty';

export interface SmsTemplate {
  id: SmsTemplateId;
  name: string; // 送信履歴のタイトルに使用
}

export const smsTemplates: SmsTemplate[] = [
  { id: 'viewing_inquiry', name: '内覧問合せ' },
  { id: 'empty', name: '空' },
];

/**
 * SMS本文を生成する純粋関数
 * @param templateId テンプレート種別
 * @param params 物件情報・売主情報
 * @returns 生成されたSMS本文
 */
export function generateSmsBody(
  templateId: SmsTemplateId,
  params: {
    sellerName?: string | null;
    address?: string | null;
  }
): string {
  // sellerName が null/undefined の場合は「オーナー」で代替する（要件4.5）
  const sellerName = params.sellerName ?? 'オーナー';
  // address が null/undefined の場合は空文字で代替する
  const address = params.address ?? '';

  switch (templateId) {
    case 'viewing_inquiry':
      return `${sellerName}様\n\nお世話になっております。\n${address}の内覧についてご連絡させていただきました。\nご都合のよい日時をお知らせいただけますでしょうか。\n\n株式会社いふう`;

    case 'empty':
      return '株式会社いふう';
  }
}
