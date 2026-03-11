/**
 * 買主AppSheetカラムマッピング
 *
 * AppSheetのカラム名とデータベースのカラム名のマッピングを定義します。
 */

export interface ColumnMapping {
  appsheetColumn: string;
  dbColumn: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  description: string;
}

export const BUYER_COLUMN_MAPPINGS: ColumnMapping[] = [
  // 基本情報
  { appsheetColumn: '買主番号', dbColumn: 'buyer_number', type: 'string', description: '買主の一意識別子' },
  { appsheetColumn: '氏名', dbColumn: 'name', type: 'string', description: '買主名' },
  { appsheetColumn: '電話番号', dbColumn: 'phone_number', type: 'string', description: '電話番号' },
  { appsheetColumn: 'メールアドレス', dbColumn: 'email', type: 'string', description: 'メールアドレス' },
  { appsheetColumn: '物件番号', dbColumn: 'property_number', type: 'string', description: '物件番号' },

  // 日付フィールド
  { appsheetColumn: '受付日', dbColumn: 'reception_date', type: 'date', description: '受付日' },
  { appsheetColumn: '最新内覧日', dbColumn: 'latest_viewing_date', type: 'date', description: '最新内覧日' },
  { appsheetColumn: '次電日', dbColumn: 'next_call_date', type: 'date', description: '次回電話日' },

  // ステータスフィールド
  { appsheetColumn: '追客担当', dbColumn: 'follow_up_assignee', type: 'string', description: '追客担当者' },
  { appsheetColumn: '最新状況', dbColumn: 'latest_status', type: 'string', description: '最新状況' },
  { appsheetColumn: '問合せ時確度', dbColumn: 'inquiry_confidence', type: 'string', description: '問合せ時確度' },

  // 問い合わせ関連
  { appsheetColumn: '問合メール電話', dbColumn: 'inquiry_email_phone', type: 'string', description: '問合せメール/電話' },
  { appsheetColumn: '問合メール返信', dbColumn: 'inquiry_email_reply', type: 'string', description: '問合せメール返信' },
  { appsheetColumn: '3回架電確認', dbColumn: 'three_calls_confirmed', type: 'string', description: '3回架電確認' },
  { appsheetColumn: '業者問合せ', dbColumn: 'broker_inquiry', type: 'string', description: '業者問合せ' },
  { appsheetColumn: '問合せ元', dbColumn: 'inquiry_source', type: 'string', description: '問合せ元' },

  // 内覧関連
  { appsheetColumn: '内覧後フォロー', dbColumn: 'viewing_result_follow_up', type: 'string', description: '内覧後フォロー' },
  { appsheetColumn: '内覧未確定', dbColumn: 'viewing_unconfirmed', type: 'string', description: '内覧未確定' },
  { appsheetColumn: '一般媒介', dbColumn: 'viewing_type_general', type: 'string', description: '一般媒介' },
  { appsheetColumn: '内覧後売主連絡', dbColumn: 'post_viewing_seller_contact', type: 'string', description: '内覧後売主連絡' },
  { appsheetColumn: '通知送信者', dbColumn: 'notification_sender', type: 'string', description: '通知送信者' },

  // アンケート関連
  { appsheetColumn: '査定アンケート', dbColumn: 'valuation_survey', type: 'string', description: '査定アンケート' },
  { appsheetColumn: '査定アンケート確認', dbColumn: 'valuation_survey_confirmed', type: 'string', description: '査定アンケート確認' },
  { appsheetColumn: '業者向けアンケート', dbColumn: 'broker_survey', type: 'string', description: '業者向けアンケート' },

  // その他
  { appsheetColumn: '曜日', dbColumn: 'day_of_week', type: 'string', description: '曜日' },
  { appsheetColumn: 'Pinrich', dbColumn: 'pinrich', type: 'string', description: 'Pinrichステータス' },
  { appsheetColumn: 'メアド確認', dbColumn: 'email_confirmation', type: 'string', description: 'メアド確認' },
  { appsheetColumn: 'メアド確認担当', dbColumn: 'email_confirmation_assignee', type: 'string', description: 'メアド確認担当' },
  { appsheetColumn: '内覧促進不要', dbColumn: 'viewing_promotion_not_needed', type: 'string', description: '内覧促進不要' },
  { appsheetColumn: '内覧促進送信者', dbColumn: 'viewing_promotion_sender', type: 'string', description: '内覧促進送信者' },
  { appsheetColumn: '過去買主リスト', dbColumn: 'past_buyer_list', type: 'string', description: '過去買主リスト' },
  { appsheetColumn: '価格', dbColumn: 'price', type: 'string', description: '価格' },

  // 希望条件
  { appsheetColumn: '希望エリア', dbColumn: 'desired_area', type: 'string', description: '希望エリア' },
  { appsheetColumn: '希望種別', dbColumn: 'desired_property_type', type: 'string', description: '希望種別' },
  { appsheetColumn: '配信種別', dbColumn: 'distribution_type', type: 'string', description: '配信種別' },
  { appsheetColumn: '価格帯（戸建）', dbColumn: 'price_range_house', type: 'string', description: '価格帯（戸建）' },
  { appsheetColumn: '価格帯（マンション）', dbColumn: 'price_range_apartment', type: 'string', description: '価格帯（マンション）' },
  { appsheetColumn: '価格帯（土地）', dbColumn: 'price_range_land', type: 'string', description: '価格帯（土地）' },

  // 初動担当
  { appsheetColumn: '初動担当', dbColumn: 'initial_assignee', type: 'string', description: '初動担当者' },
];

/**
 * AppSheetカラム名からDBカラム名を取得
 */
export function getDbColumn(appsheetColumn: string): string | null {
  const mapping = BUYER_COLUMN_MAPPINGS.find(m => m.appsheetColumn === appsheetColumn);
  return mapping?.dbColumn || null;
}

/**
 * DBカラム名からAppSheetカラム名を取得
 */
export function getAppsheetColumn(dbColumn: string): string | null {
  const mapping = BUYER_COLUMN_MAPPINGS.find(m => m.dbColumn === dbColumn);
  return mapping?.appsheetColumn || null;
}
