/**
 * 営業会議「他決数推移」の集計ロジック（会計年度＝10月〜翌9月ベース）
 *
 * ■ 期の定義
 * - 1期は「10月〜翌9月」。終了年でラベルする（例：2026年度 ＝ 2025/10〜2026/9 ＝今期）。
 * - 月の並びは 10月始まり（10, 11, 12, 1, 2, …, 9）。
 * - 期の頭（前年10〜12月）のデータが欠けている古い期は「参考」（不完全）として表示する。
 *
 * ■ 集計方針（元シートの計算セルは使わず、すべてここで再計算）
 * - 合計 : 12ヶ月の合計（比率行は「分子の合計 ÷ 分母の合計」）
 * - 平均 : 合計 ÷ 実績月数（比率行は実績月の月次比率の平均）
 * - 前年比: 当期合計 ÷ 前期合計
 * - 実績月: その期で「依頼件数」に値が入っている月数（今期は9ヶ月）
 */
import {
  ALL_ROWS,
  isDerived,
  YEARS as CALENDAR_YEARS,
  type TrendRow,
  type YearKey as CalendarYearKey,
} from '../data/salesMeetingLossTrendData';

// ---------------------------------------------------------------------------
// 期（会計年度）の定義
// ---------------------------------------------------------------------------
/** 期キー（終了年）。'FY2026' ＝ 2025/10〜2026/9 */
export type PeriodKey = 'FY2022' | 'FY2023' | 'FY2024' | 'FY2025' | 'FY2026';

export const PERIODS: PeriodKey[] = ['FY2022', 'FY2023', 'FY2024', 'FY2025', 'FY2026'];

/** 表示ラベル（終了年で呼ぶ） */
export const PERIOD_LABEL: Record<PeriodKey, string> = {
  FY2022: '2022年度',
  FY2023: '2023年度',
  FY2024: '2024年度',
  FY2025: '2025年度',
  FY2026: '2026年度',
};

/** 期の期間（人が読む用） */
export const PERIOD_RANGE: Record<PeriodKey, string> = {
  FY2022: '2021/10〜2022/9',
  FY2023: '2022/10〜2023/9',
  FY2024: '2023/10〜2024/9',
  FY2025: '2024/10〜2025/9',
  FY2026: '2025/10〜2026/9',
};

/** 期の終了年（数値） */
const endYear = (p: PeriodKey): number => Number(p.slice(2));

/** 10月始まりの月ラベル */
export const FISCAL_MONTH_LABELS = [
  '10月', '11月', '12月', '1月', '2月', '3月',
  '4月', '5月', '6月', '7月', '8月', '9月',
];

/**
 * 期の各スロット（0=10月 … 11=9月）が、どの暦年・暦月（1-12）にあたるか。
 * 10〜12月は前年、1〜9月は終了年。
 */
type Slot = { calYear: number; calMonth: number };
function periodSlots(p: PeriodKey): Slot[] {
  const e = endYear(p);
  const slots: Slot[] = [];
  // 10, 11, 12 月（前年）
  for (const mo of [10, 11, 12]) slots.push({ calYear: e - 1, calMonth: mo });
  // 1〜9 月（終了年）
  for (let mo = 1; mo <= 9; mo++) slots.push({ calYear: e, calMonth: mo });
  return slots;
}

const calYearSet = new Set<number>(CALENDAR_YEARS.map((y) => Number(y)));

/** 期の各スロットが元データ（暦年）でカバーされているか（参考／不完全の判定に使う） */
function periodCoverage(p: PeriodKey): boolean[] {
  return periodSlots(p).map((s) => calYearSet.has(s.calYear));
}

/** その期が「不完全（期の一部の暦年が元データに無い）」か */
export function isPartialPeriod(p: PeriodKey): boolean {
  return periodCoverage(p).some((covered) => !covered);
}

// ---------------------------------------------------------------------------
// 行の解決（暦年の月次データ → 期の月次データへ組み替え）
// ---------------------------------------------------------------------------
export type RowType = 'count' | 'percent' | 'ratio';

export type ResolvedRow = {
  key: string;
  label: string;
  note?: string;
  type: RowType;
  /** 期の月次値（0=10月 … 11=9月）。ratio は比率(0〜1)、percent は％値、count は件数 */
  monthly: (number | null)[];
  /** ratio 行の分子・分母（合計を正しく出すために保持） */
  numMonthly?: (number | null)[];
  denMonthly?: (number | null)[];
};

const EMPTY12 = (): (number | null)[] => Array(12).fill(null);

/** 実数行の「暦年→月配列」から、指定した期の月次（10月始まり）を取り出す */
function baseRowFiscalMonthly(
  values: Partial<Record<CalendarYearKey, (number | null)[]>>,
  p: PeriodKey,
): (number | null)[] {
  return periodSlots(p).map((s) => {
    const arr = values[String(s.calYear) as CalendarYearKey];
    if (!arr) return null;
    return arr[s.calMonth - 1] ?? null;
  });
}

/** 複数行を月ごとに足し引きする（すべて null の月は null のまま） */
function combine(
  resolved: Map<string, ResolvedRow>,
  plus: string[],
  minus: string[] = [],
): (number | null)[] | undefined {
  const out = EMPTY12();
  for (const [keys, sign] of [[plus, 1], [minus, -1]] as const) {
    for (const key of keys) {
      const r = resolved.get(key);
      if (!r) return undefined; // 依存先がまだ未解決
      for (let i = 0; i < 12; i++) {
        const v = r.monthly[i];
        if (v === null) continue;
        out[i] = (out[i] ?? 0) + sign * v;
      }
    }
  }
  return out;
}

/** 指定した期の全行を解決する（計算行は依存が解けるまで繰り返す） */
export function resolvePeriod(p: PeriodKey): Map<string, ResolvedRow> {
  const resolved = new Map<string, ResolvedRow>();

  // 1) 実数行（暦年→期の月次に組み替え）
  for (const row of ALL_ROWS) {
    if (isDerived(row)) continue;
    resolved.set(row.key, {
      key: row.key,
      label: row.label,
      note: row.note,
      type: row.unit === 'percent' ? 'percent' : 'count',
      monthly: baseRowFiscalMonthly(row.values, p),
    });
  }

  // 2) 計算行（依存関係があるので複数パス）
  const pending = ALL_ROWS.filter(isDerived);
  for (let pass = 0; pass < 6 && pending.length > 0; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const row = pending[i];

      if (row.kind === 'sum') {
        const monthly = combine(resolved, row.parts, row.minus ?? []);
        if (!monthly) continue;
        resolved.set(row.key, {
          key: row.key,
          label: row.label,
          note: row.note,
          type: 'count',
          monthly,
        });
        pending.splice(i, 1);
        continue;
      }

      const num = resolved.get(row.num);
      const den = combine(resolved, row.plus, row.minus ?? []);
      if (!num || !den) continue;
      const monthly = EMPTY12();
      for (let mi = 0; mi < 12; mi++) {
        const n = num.monthly[mi];
        const d = den[mi];
        monthly[mi] = n === null || d === null || d === 0 ? null : n / d;
      }
      resolved.set(row.key, {
        key: row.key,
        label: row.label,
        note: row.note,
        type: 'ratio',
        monthly,
        numMonthly: num.monthly,
        denMonthly: den,
      });
      pending.splice(i, 1);
    }
  }

  return resolved;
}

export const RESOLVED_BY_PERIOD: Record<PeriodKey, Map<string, ResolvedRow>> = PERIODS.reduce(
  (acc, p) => {
    acc[p] = resolvePeriod(p);
    return acc;
  },
  {} as Record<PeriodKey, Map<string, ResolvedRow>>,
);

/** その期の実績月数（「依頼件数」に値が入っている月数） */
export function activeMonthCount(p: PeriodKey): number {
  const req = RESOLVED_BY_PERIOD[p].get('依頼件数');
  if (!req) return 12;
  const n = req.monthly.filter((v) => v !== null && v > 0).length;
  return n > 0 ? n : 12;
}

export const ACTIVE_MONTHS: Record<PeriodKey, number> = PERIODS.reduce((acc, p) => {
  acc[p] = activeMonthCount(p);
  return acc;
}, {} as Record<PeriodKey, number>);

/** 12ヶ月すべてを合計する（値が1つも無ければ null） */
const sumAll = (arr: (number | null)[] | undefined): number | null => {
  if (!arr) return null;
  let sum = 0;
  let found = false;
  for (let i = 0; i < 12; i++) {
    const v = arr[i];
    if (v === null || v === undefined) continue;
    sum += v;
    found = true;
  }
  return found ? sum : null;
};

/**
 * 合計（比率行は「分子合計 ÷ 分母合計」）
 * 合計は12ヶ月すべてを対象にする。未到来月に値が入っている行を取りこぼさないため。
 */
export function rowTotal(row: ResolvedRow, _p: PeriodKey): number | null {
  if (row.type === 'ratio') {
    const n = sumAll(row.numMonthly);
    const d = sumAll(row.denMonthly);
    return n === null || d === null || d === 0 ? null : n / d;
  }
  if (row.type === 'percent') return null; // ％入力行は合計を出さない
  return sumAll(row.monthly);
}

/**
 * 平均（実績月ベース）
 * - 件数行: 合計 ÷ 実績月数
 * - 比率・％行: 実績月の月次値の単純平均（未到来月の仮値を平均に含めない）
 */
export function rowAverage(row: ResolvedRow, p: PeriodKey): number | null {
  const months = ACTIVE_MONTHS[p];
  if (row.type === 'count') {
    const total = sumAll(row.monthly);
    return total === null ? null : total / months;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < months; i++) {
    const v = row.monthly[i];
    if (v === null || v === undefined) continue;
    sum += v;
    count++;
  }
  return count ? sum / count : null;
}

/** 前年比（当期合計 ÷ 前期合計） */
export function rowYoY(key: string, p: PeriodKey): number | null {
  const idx = PERIODS.indexOf(p);
  if (idx <= 0) return null;
  const prev = PERIODS[idx - 1];
  const cur = RESOLVED_BY_PERIOD[p].get(key);
  const prevRow = RESOLVED_BY_PERIOD[prev].get(key);
  if (!cur || !prevRow) return null;
  const c = rowTotal(cur, p);
  const q = rowTotal(prevRow, prev);
  if (c === null || q === null || q === 0) return null;
  return c / q;
}

/** その期にデータが1つも無い行か */
export function isEmptyRow(row: ResolvedRow): boolean {
  return row.monthly.every((v) => v === null);
}

const rowByKey = new Map<string, TrendRow>(ALL_ROWS.map((r) => [r.key, r]));
export const rowDefKey = (r: TrendRow) => r.key;
export const rowDef = (key: string) => rowByKey.get(key);

// ---------------------------------------------------------------------------
// 表示用フォーマッタ
// ---------------------------------------------------------------------------
export function fmtCount(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtRatio(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtPercentValue(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(digits)}%`;
}

/** 行の種類に応じてセル表示を切り替える */
export function fmtCell(row: ResolvedRow, v: number | null | undefined): string {
  if (row.type === 'ratio') return fmtRatio(v);
  if (row.type === 'percent') return fmtPercentValue(v);
  return fmtCount(v);
}
