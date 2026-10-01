import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * 営業会議「他決数推移」ページ用: 他決件数を FI（福岡）/ AA（大分）別に、
 * かつ 訪問済み / 未訪問 別に、会計年度（10月〜翌9月）の月次で集計する。
 *
 * ■ 判定ルール（既存の salesMeetingLossAnalysis.ts に準拠）
 *   - 他決とみなすステータス: status ∈ LOSS_STATUSES
 *   - 訪問済み: 営担（visit_assignee）に有効な値がある（空・null は未訪問）
 *   - 地域: seller_number の接頭辞。'FI…' = 福岡、それ以外（'AA…'）= 大分(AA)
 *   - 期の割り当て: contract_year_month（他決が分かった時点）で判定する。
 *     これは既存の他決分析APIと同じ日付基準。
 *
 * ■ 会計年度（期）の定義（フロント salesMeetingLossTrend.ts と一致）
 *   - 1期 = 10月〜翌9月。終了年でラベル（FY2026 = 2025/10〜2026/9）。
 *   - 月スロットは 10月始まり（index 0=10月 … 11=9月）。
 *
 * ■ レスポンス
 * {
 *   data: {
 *     FY2022: { FI: {...}, AA: {...} },
 *     ...
 *     FY2026: {
 *       FI: { visited: number[12], unvisited: number[12] },
 *       AA: { visited: number[12], unvisited: number[12] },
 *     }
 *   }
 * }
 * 配列は会計月スロット（0=10月 … 11=9月）ごとの他決件数。
 */

// 他決とみなすステータス（既存の他決分析APIと同一）
const LOSS_STATUSES = ['他決→追客', '他決→追客不要'];

// フロントの PeriodKey と一致（終了年）
type PeriodKey = 'FY2022' | 'FY2023' | 'FY2024' | 'FY2025' | 'FY2026';
const PERIODS: PeriodKey[] = ['FY2022', 'FY2023', 'FY2024', 'FY2025', 'FY2026'];

const endYear = (p: PeriodKey): number => Number(p.slice(2));

/** 対象期間全体（最古の期の開始 〜 最新の期の終了）のISO日付範囲 */
function overallRange(): { start: string; end: string } {
  // FY2022 = 2021/10〜2022/9, FY2026 = 2025/10〜2026/9
  const minEnd = endYear(PERIODS[0]);
  const maxEnd = endYear(PERIODS[PERIODS.length - 1]);
  const start = `${minEnd - 1}-10-01`;
  const end = `${maxEnd}-09-30`;
  return { start, end };
}

/**
 * 暦年・暦月（1-12）から、該当する会計期キーと会計月スロット（0=10月…11=9月）を返す。
 * 対象外（どの期にも属さない）は null。
 */
function fiscalSlot(calYear: number, calMonth: number): { period: PeriodKey; slot: number } | null {
  // 10,11,12月 → その暦年+1 が終了年の期、スロット 0/1/2
  // 1〜9月     → その暦年 が終了年の期、スロット 3〜11
  let end: number;
  let slot: number;
  if (calMonth >= 10) {
    end = calYear + 1;
    slot = calMonth - 10; // 10→0, 11→1, 12→2
  } else {
    end = calYear;
    slot = calMonth + 2; // 1→3, 2→4, …, 9→11
  }
  const period = `FY${end}` as PeriodKey;
  if (!PERIODS.includes(period)) return null;
  return { period, slot };
}

/** contract_year_month（"YYYY-MM-01" 等）から暦年・暦月を取り出す */
function parseYearMonth(value: string | null): { year: number; month: number } | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  // contract_year_month は日付型（月初）だが、UTCで年月を取り出す
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** 営担ありなら訪問済み（空・null は未訪問）。既存 competitor 集計と同じ緩い判定。 */
function isVisited(visitAssignee: string | null): boolean {
  return !!(visitAssignee && visitAssignee.trim() !== '');
}

/** FI（福岡）売主かどうか。seller_number が 'FI' で始まる。 */
function isFi(sellerNumber: string | null): boolean {
  return (sellerNumber || '').toUpperCase().startsWith('FI');
}

type RegionBucket = { visited: number[]; unvisited: number[] };
type PeriodBucket = { FI: RegionBucket; AA: RegionBucket };

const emptyRegion = (): RegionBucket => ({
  visited: Array(12).fill(0),
  unvisited: Array(12).fill(0),
});

/**
 * GET /api/sales-meeting/loss-fi-aa-stats
 *
 * 他決件数を FI/AA × 訪問済み/未訪問 × 会計月（10月始まり）で集計して返す。
 */
router.get('/loss-fi-aa-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { start, end } = overallRange();

    const pageSize = 1000;
    let from = 0;
    const rows: Array<{
      seller_number: string | null;
      status: string | null;
      visit_assignee: string | null;
      contract_year_month: string | null;
    }> = [];

    for (;;) {
      const { data, error } = await supabase
        .from('sellers')
        .select('seller_number, status, visit_assignee, contract_year_month')
        .in('status', LOSS_STATUSES)
        .gte('contract_year_month', start)
        .lte('contract_year_month', end)
        .is('deleted_at', null)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...(data as any));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // 集計器を初期化（全期 × FI/AA × visited/unvisited × 12スロット を 0）
    const stats: Record<PeriodKey, PeriodBucket> = {} as any;
    for (const p of PERIODS) {
      stats[p] = { FI: emptyRegion(), AA: emptyRegion() };
    }

    for (const row of rows) {
      const ym = parseYearMonth(row.contract_year_month);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;

      const region = isFi(row.seller_number) ? 'FI' : 'AA';
      const bucketKey = isVisited(row.visit_assignee) ? 'visited' : 'unvisited';
      stats[fs.period][region][bucketKey][fs.slot] += 1;
    }

    res.json({ data: stats });
  } catch (error: any) {
    console.error('Failed to compute loss FI/AA stats:', error);
    res.status(500).json({ error: '他決FI/AA集計の取得に失敗しました', details: error.message });
  }
});

export default router;
