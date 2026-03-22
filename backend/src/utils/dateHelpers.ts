/**
 * 日付ヘルパー関数
 *
 * AppSheetのIFSロジックで使用される日付関連の条件判定をサポートします。
 */

/**
 * YYYY-MM-DD 形式の文字列をJSTのローカル日付として解釈する
 * new Date('2026-03-22') はUTC 00:00として解釈されるため、
 * JST（UTC+9）では前日の15:00になってしまう問題を回避する
 */
function parseDateLocal(date: Date | string): Date {
  if (typeof date === 'string') {
    // YYYY-MM-DD 形式の場合はローカル時刻として解釈
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    return new Date(date);
  }
  return date;
}

/**
 * 指定された日付が今日かどうかを判定
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const today = new Date();
  return (
    targetDate.getFullYear() === today.getFullYear() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getDate() === today.getDate()
  );
}

/**
 * 指定された日付が明日かどうかを判定
 */
export function isTomorrow(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    targetDate.getFullYear() === tomorrow.getFullYear() &&
    targetDate.getMonth() === tomorrow.getMonth() &&
    targetDate.getDate() === tomorrow.getDate()
  );
}

/**
 * 指定された日付が過去かどうかを判定
 */
export function isPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
}

/**
 * 指定された日付の曜日を日本語で取得
 */
export function getDayOfWeek(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return null;
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return days[targetDate.getDay()];
}

/**
 * 今日の曜日を日本語で取得
 */
export function getTodayDayOfWeek(): string {
  return getDayOfWeek(new Date()) || '';
}

/**
 * 指定された日付が今日から指定日数後かどうかを判定
 */
export function isDaysFromToday(date: Date | string | null | undefined, days: number): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  return (
    targetDate.getFullYear() === futureDate.getFullYear() &&
    targetDate.getMonth() === futureDate.getMonth() &&
    targetDate.getDate() === futureDate.getDate()
  );
}

/**
 * 指定された日付が今日以前かどうかを判定
 */
export function isTodayOrPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate <= today;
}

/**
 * 指定された日付が指定範囲内かどうかを判定
 * @param minDaysAgo 最小日数（過去） - 例: 14 = 14日前まで
 * @param maxDaysAgo 最大日数（過去） - 例: 4 = 4日前から
 * 
 * 例: isWithinDaysAgo(date, 14, 4) → 14日前 <= date <= 4日前
 */
export function isWithinDaysAgo(
  date: Date | string | null | undefined,
  minDaysAgo: number,
  maxDaysAgo: number
): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  // 経過日数を計算
  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // maxDaysAgo日前から minDaysAgo日前までの範囲
  // 例: isWithinDaysAgo(date, 14, 4) → 4日 <= 経過日数 <= 14日
  return diffDays >= maxDaysAgo && diffDays <= minDaysAgo;
}

/**
 * 指定された日付が指定日付以降かどうかを判定
 */
export function isAfterOrEqual(
  date: Date | string | null | undefined,
  compareDate: Date | string
): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const compDate = typeof compareDate === 'string' ? new Date(compareDate) : compareDate;
  if (isNaN(compDate.getTime())) return false;
  targetDate.setHours(0, 0, 0, 0);
  compDate.setHours(0, 0, 0, 0);
  return targetDate >= compDate;
}
