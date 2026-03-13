/**
 * 買主詳細ページのフィールド選択肢定義
 * 表示順・選択肢の変更は一元管理
 */

// 他物件ヒアリング
export const OTHER_PROPERTY_HEARING_OPTIONS = [
  { value: '有', label: '有' },
  { value: '無（他社確認したが良物件取れず）', label: '無（他社確認したが良物件取れず）' },
  { value: '確認方法', label: '確認方法' },
];

// 内覧促進メール不要
export const VIEWING_PROMOTION_EMAIL_OPTIONS = [
  { value: '不要', label: '不要' },
];

// メアド確認
export const EMAIL_CONFIRMATION_OPTIONS = [
  { value: '確認OK', label: '確認OK' },
  { value: '聞かれる(rもって行かない)', label: '聞かれる(rもって行かない)' },
  { value: '未確認', label: '未確認' },
  { value: '送信失敗履歴あり', label: '送信失敗履歴あり' },
];

// Pinrich
export const PINRICH_OPTIONS = [
  { value: '送信中', label: '送信中' },
  { value: 'クローズ', label: 'クローズ' },
  { value: '登録不要（一時可）', label: '登録不要（一時可）' },
  { value: '500万以上の設定済み', label: '500万以上の設定済み' },
  { value: '送信済（女性確認より）', label: '送信済（女性確認より）' },
  { value: '登録無い', label: '登録無い' },
  { value: '2件目以降', label: '2件目以降' },
  { value: '受信エラー', label: '受信エラー' },
];

// 内覧未確定
export const VIEWING_UNCONFIRMED_OPTIONS = [
  { value: '未確定', label: '未確定' },
];

// 画像チャット送信
export const IMAGE_CHAT_SENT_OPTIONS = [
  { value: 'Y(送信済)', label: 'Y(送信済)' },
  { value: 'N(送信無)', label: 'N(送信無)' },
];

// 仮審査
export const PRELIMINARY_SCREENING_OPTIONS = [
  { value: '有', label: '有' },
  { value: '無（当日中）', label: '無（当日中）' },
  { value: '未', label: '未' },
];

// 現在住居
export const CURRENT_RESIDENCE_OPTIONS = [
  { value: '持家（戸建）', label: '持家（戸建）' },
  { value: '賃貸', label: '賃貸' },
  { value: '持家（マンション）', label: '持家（マンション）' },
  { value: '社宅', label: '社宅' },
];
