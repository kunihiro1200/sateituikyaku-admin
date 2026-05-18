/**
 * 反響日付表示ユーティリティ
 * 
 * 反響詳細日時（inquiryDetailedDatetime）があれば日時形式で表示し、
 * なければ反響日付（inquiryDate）を日付形式で表示する
 * 
 * ⚠️ タイムゾーン注意：
 * inquiry_detailed_datetime はDBにJST文字列（"2026-05-19 01:34:33"）として保存されている。
 * new Date() で変換するとUTC扱いになり+9時間ずれるため、
 * 文字列を正規表現で直接パースして表示する。
 */

export interface SellerDateInfo {
  inquiryDate?: string | Date | null;
  inquiryDetailedDatetime?: string | Date | null;
}

/**
 * 反響日付をフォーマットして表示用文字列を返す
 * 
 * **Feature: inquiry-date-display-enhancement, Property 1: 反響詳細日時優先表示**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 3.3**
 * 
 * @param seller - 売主データ（inquiryDate, inquiryDetailedDatetimeを含む）
 * @returns フォーマットされた日付文字列、または '-'
 */
export const formatInquiryDate = (seller: SellerDateInfo): string => {
  try {
    // Property 1: 反響詳細日時が存在すれば優先的に表示
    if (seller.inquiryDetailedDatetime) {
      const raw = String(seller.inquiryDetailedDatetime);
      // "2026-05-19 01:34:33" または "2026-05-19T01:34:33" 形式を直接パース
      // new Date() を使わずタイムゾーン変換を防ぐ（+9時間ずれ防止）
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (match) {
        // Property 3: 日時形式で表示（YYYY/MM/DD HH:MM）
        return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
      }
    }
    // Property 2: 反響詳細日時がない場合は反響日付を表示
    if (seller.inquiryDate) {
      const rawDate = String(seller.inquiryDate);
      // "2026-05-19" 形式を直接パース
      const matchDate = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchDate) {
        // Property 4: 日付形式で表示（YYYY/MM/DD）
        return `${matchDate[1]}/${matchDate[2]}/${matchDate[3]}`;
      }
    }
  } catch (error) {
    console.error('Date formatting error:', error);
  }
  return '-';
};

/**
 * 表示された日付文字列に時刻情報が含まれているかを判定
 * 
 * @param formattedDate - フォーマットされた日付文字列
 * @returns 時刻情報（HH:MM形式）が含まれていればtrue
 */
export const hasTimeInfo = (formattedDate: string): boolean => {
  // 日本語ロケールの時刻形式（例: "2024/01/15 10:30"）をチェック
  // 時:分 のパターンを検出
  return /\d{1,2}:\d{2}/.test(formattedDate);
};
