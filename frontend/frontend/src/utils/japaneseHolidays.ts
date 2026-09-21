/**
 * 日本の祝日判定ユーティリティ
 *
 * 内閣府の祝日法に基づく固定祝日 + ハッピーマンデー + 春分/秋分（概算）を判定する。
 * 訪問予約で祝日休みのスタッフ（I・Y）の予約を弾く用途などに使用する。
 */

/**
 * 「祝日法に定められた祝日そのもの」かどうかを判定する（振替休日・国民の休日は含まない）
 * 振替休日・国民の休日の判定に内部利用する。
 */
const isNamedHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 固定祝日
  const fixedHolidays: [number, number][] = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [2, 23],  // 天皇誕生日
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
  ];
  if (fixedHolidays.some(([m, d]) => month === m && day === d)) return true;

  // ハッピーマンデー
  const getMonday = (y: number, m: number, n: number): number => {
    const first = new Date(y, m - 1, 1);
    const firstMonday = first.getDay() <= 1 ? (1 + (1 - first.getDay() + 7) % 7) : (1 + (8 - first.getDay()));
    return firstMonday + (n - 1) * 7;
  };
  if (month === 1 && day === getMonday(year, 1, 2)) return true;  // 成人の日
  if (month === 7 && day === getMonday(year, 7, 3)) return true;  // 海の日
  if (month === 9 && day === getMonday(year, 9, 3)) return true;  // 敬老の日
  if (month === 10 && day === getMonday(year, 10, 2)) return true; // スポーツの日

  // 春分の日・秋分の日（概算）
  if (month === 3) {
    const vernal = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    if (day === vernal) return true;
  }
  if (month === 9) {
    const autumnal = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
    if (day === autumnal) return true;
  }

  return false;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
};

/**
 * 振替休日かどうかを判定する
 * ルール: 祝日が日曜日の場合、その直後の（祝日でない）平日を振替休日とする。
 * 連続して祝日が続く場合はさらに後ろにずれる。
 */
const isSubstituteHoliday = (date: Date): boolean => {
  // その日自身が祝日なら振替休日ではない
  if (isNamedHoliday(date)) return false;
  // 日曜日は振替休日にならない
  if (date.getDay() === 0) return false;

  // さかのぼって、直近の日曜の祝日を探す（間が全て祝日で埋まっているか確認）
  let cursor = addDays(date, -1);
  // 手前が祝日で連続している間さかのぼる
  while (isNamedHoliday(cursor)) {
    if (cursor.getDay() === 0) {
      // 日曜の祝日にたどり着いた → date は振替休日
      return true;
    }
    cursor = addDays(cursor, -1);
  }
  return false;
};

/**
 * 国民の休日かどうかを判定する
 * ルール: 前日と翌日がともに祝日（振替休日を除く「祝日法上の祝日」）で、
 * その日自身が祝日でない平日（日曜以外）である場合。
 * 例: 敬老の日（第3月曜）と秋分の日に挟まれた平日。
 */
const isNationalHoliday = (date: Date): boolean => {
  if (isNamedHoliday(date)) return false;
  if (date.getDay() === 0) return false; // 日曜は国民の休日にならない
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  return isNamedHoliday(prev) && isNamedHoliday(next);
};

/**
 * 指定した日付が日本の祝日かどうかを判定する
 * （祝日法上の祝日 + 振替休日 + 国民の休日）
 */
export const isJapaneseHoliday = (date: Date): boolean => {
  if (isNamedHoliday(date)) return true;
  if (isSubstituteHoliday(date)) return true;
  if (isNationalHoliday(date)) return true;
  return false;
};

/**
 * "YYYY-MM-DD" 形式の日付文字列が祝日かどうかを判定する
 * （タイムゾーン変換を避けるためローカル日付として解釈する）
 */
export const isJapaneseHolidayDateStr = (dateStr: string): boolean => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return false;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return isJapaneseHoliday(new Date(y, m - 1, d));
};
