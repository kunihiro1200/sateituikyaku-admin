/**
 * 日付ヘルパー関数
 *
 * AppSheetのIFSロジックで使用される日付関連の条件判定をサポートします。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

/**
 * 任意の日付文字列をJSTの「年/月/日」として解釈し、
 * その日の JST 00:00:00 に相当する Date オブジェクトを返す。
 *
 * - "2026-03-23"                    → JST 2026-03-23
 * - "2026-03-23T00:00:00+00:00"     → UTC 00:00 = JST 09:00 → JST 日付は 2026-03-23
 * - "2026-03-22T15:00:00+00:00"     → UTC 15:00 = JST 00:00 → JST 日付は 2026-03-23
 *
 * Vercel本番（UTC）でもローカル（JST）でも同じ結果になる。
 */
function parseDateLocal(date: Date | string): Date {
  if (typeof date === 'string') {
    // タイムゾーン情報なし（YYYY-MM-DD）の場合は JST の日付として扱う
    const plainMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plainMatch) {
      // JST 00:00:00 = UTC -9h として Date を作成
      return new Date(Date.UTC(
        parseInt(plainMatch[1]),
        parseInt(plainMatch[2]) - 1,
        parseInt(plainMatch[3])
      ) - JST_OFFSET_MS);
    }
    // タイムゾーン付き（ISO 8601）の場合は UTC に変換してから JST 日付を取得
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      const jstMs = d.getTime() + JST_OFFSET_MS;
      const jst = new Date(jstMs);
      return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS);
    }
    return new Date(date);
  }
  // Date オブジェクトの場合も JST 日付に正規化
  const jstMs = date.getTime() + JST_OFFSET_MS;
  const jst = new Date(jstMs);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET_MS);
}

/**
 * 今日の JST 00:00:00 に相当する Date を返す
 */
function todayJST(): Date {
  return parseDateLocal(new Date());
}

/**
 * 指定された日付が今日かどうかを判定
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const today = todayJST();
  return targetDate.getTime() === today.getTime();
}

/**
 * 指定された日付が明日かどうかを判定
 */
export function isTomorrow(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  const tomorrow = todayJST();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return targetDate.getTime() === tomorrow.getTime();
}

/**
 * 指定された日付が過去かどうかを判定
 */
export function isPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  return targetDate < todayJST();
}

/**
 * 指定された日付の曜日を日本語で取得
 */
export function getDayOfWeek(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return null;
  // JST 00:00 として格納されているので UTC の曜日を使う
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return days[targetDate.getUTCDay()];
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
  const futureDate = todayJST();
  futureDate.setUTCDate(futureDate.getUTCDate() + days);
  return targetDate.getTime() === futureDate.getTime();
}

/**
 * 指定された日付が今日以前かどうかを判定
 */
export function isTodayOrPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const targetDate = parseDateLocal(date);
  if (isNaN(targetDate.getTime())) return false;
  return targetDate <= todayJST();
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
  const today = todayJST();

  // 経過日数を計算（ms → 日数）
  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // maxDaysAgo日前から minDaysAgo日前までの範囲
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
  const compDate = parseDateLocal(compareDate);
  if (isNaN(compDate.getTime())) return false;
  return targetDate >= compDate;
}
