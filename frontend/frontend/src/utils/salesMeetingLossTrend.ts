/**
 * 営業会議「他決数推移」の集計ロジック
 *
 * 元シートの 合計 / 平均 / 前年比 / 各種比率はすべてここで計算しなおす。
 * - 合計 : 実績月の合計（比率行は「分子の合計 ÷ 分母の合計」）
 * - 平均 : 実績月の平均（比率行は月次比率の単純平均）
 * - 前年比: 当年の合計 ÷ 前年の合計
 * - 実績月: その年で「依頼件数」に値が入っている月数（2026年は1〜9月の9ヶ月）
 */
import {
  ALL_ROWS,
  isDerived,
  YEARS,
  type TrendRow,
  type YearKey,
} from '../data/salesMeetingLossTrendData';

export type RowType = 'count' | 'percent' | 'ratio';

export type ResolvedRow = {
  key: string;
  label: string;
  note?: string;
  type: RowType;
  /** 1〜12月の値。ratio は比率（0〜1）、percent は％の数値、count は件数 */
  monthly: (number | null)[];
  /** ratio 行の分子・分母（合計を正しく出すために保持） */
  numMonthly?: (number | null)[];
  denMonthly?: (number | null)[];
};

const EMPTY12 = (): (number | null)[] => Array(12).fill(null);

const rowByKey = new Map<string, TrendRow>(ALL_ROWS.map((r) => [r.key, r]));

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

/** 指定年の全行を解決する（計算行は依存が解けるまで繰り返す） */
export function resolveYear(year: YearKey): Map<string, ResolvedRow> {
  const resolved = new Map<string, ResolvedRow>();

  // 1) 実数行
  for (const row of ALL_ROWS) {
    if (isDerived(row)) continue;
    resolved.set(row.key, {
      key: row.key,
      label: row.label,
      note: row.note,
      type: row.unit === 'percent' ? 'percent' : 'count',
      monthly: row.values[year] ? [...row.values[year]!] : EMPTY12(),
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

export const RESOLVED_BY_YEAR: Record<YearKey, Map<string, ResolvedRow>> = YEARS.reduce(
  (acc, y) => {
    acc[y] = resolveYear(y);
    return acc;
  },
  {} as Record<YearKey, Map<string, ResolvedRow>>,
);

/** その年の実績月数（「依頼件数」に値が入っている月数） */
export function activeMonthCount(year: YearKey): number {
  const req = RESOLVED_BY_YEAR[year].get('依頼件数');
  if (!req) return 12;
  const n = req.monthly.filter((v) => v !== null && v > 0).length;
  return n > 0 ? n : 12;
}

export const ACTIVE_MONTHS: Record<YearKey, number> = YEARS.reduce((acc, y) => {
  acc[y] = activeMonthCount(y);
  return acc;
}, {} as Record<YearKey, number>);

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
export function rowTotal(row: ResolvedRow, _year: YearKey): number | null {
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
export function rowAverage(row: ResolvedRow, year: YearKey): number | null {
  const months = ACTIVE_MONTHS[year];
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

/** 前年比（当年合計 ÷ 前年合計） */
export function rowYoY(key: string, year: YearKey): number | null {
  const idx = YEARS.indexOf(year);
  if (idx <= 0) return null;
  const prevYear = YEARS[idx - 1];
  const cur = RESOLVED_BY_YEAR[year].get(key);
  const prev = RESOLVED_BY_YEAR[prevYear].get(key);
  if (!cur || !prev) return null;
  const c = rowTotal(cur, year);
  const p = rowTotal(prev, prevYear);
  if (c === null || p === null || p === 0) return null;
  return c / p;
}

/** その年にデータが1つも無い行か */
export function isEmptyRow(row: ResolvedRow): boolean {
  return row.monthly.every((v) => v === null);
}

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
