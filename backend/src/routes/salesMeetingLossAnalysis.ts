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
 * 営業会議「他決分析」ページ用: 担当者×他決理由×年 の他決件数を集計する。
 *
 * 元のGoogleスプレッドシートの数式（COUNTIFS + IMPORTRANGE）を、
 * このシステムの sellers テーブルに置き換えて集計する。
 *
 * 元数式の条件 → DBカラム対応:
 *   - AC列（状況（当社））= 「他決→追客」または「他決→追客不要」 → sellers.status
 *   - AQ列（競合名・理由）に 理由名を含む                       → sellers.competitor_name_and_reason
 *   - AM列（契約年月 他決は分かった時点）が対象年の範囲           → sellers.contract_year_month
 *   - AB列（営担）= 担当者名                                     → sellers.visit_assignee
 *
 * このAPIは特に「林 / 麻 / K」の担当者について、理由別・年別の他決件数を返す。
 * （既存データが無い場合は 0 が返る＝新規担当者でも安全）
 */

// 他決とみなすステータス（元数式の AC列 条件）
const LOSS_STATUSES = ['他決→追客', '他決→追客不要'];

// 集計対象の担当者（イニシャル）。フロントの表と揃える。
const TARGET_ASSIGNEES = ['林', '麻', 'K'];

// 集計対象の他決理由（フロントの REASON_ROWS と同じ並び・表記）
const REASONS = [
  '①知り合い',
  '②価格が高い',
  '③決定権者の把握',
  '④連絡不足',
  '⑤購入物件の紹介',
  '⑥購入希望者がいる',
  '⑦以前つきあいがあった不動産',
  '⑧ヒアリング不足',
  '⑨担当者の対応が良い',
  '⑩査定書郵送',
  '⑪１番電話のスピード',
  '⑫対応スピード（訪問１社目もこれに含む）',
  '⑬買取保証',
  '⑭買取額が高い',
  '⑮追客電話の対応',
  '⑯説明が丁寧',
  '⑰詳細な調査',
  '⑱不誠実、やるべきことをしない',
  '⑲定期的な追客電話',
  '⑳HPの口コミ',
  '㉑売買に強い（物件数、顧客が多い）',
  '㉒仲介手数料のサービス',
  '㉓仲介手数料以外のサービス（特典）',
  '㉔妥当な査定額',
  '不明',
];

// 理由名から照合キー（丸数字などの接頭記号を除いた本文）を作る。
// competitor_name_and_reason には理由本文だけが入っていることが多いため、
// 接頭記号を落として部分一致で判定する。
function reasonMatchKey(reason: string): string {
  // 先頭の丸数字（①②…㉔）や記号を除去
  return reason.replace(/^[\u2460-\u24FF\u3251-\u32BF①-⑳㉑-㉔0-9\.\s]+/, '').trim();
}

// 年の範囲（JST基準で年の1/1〜12/31）を ISO 文字列で返す
function yearRange(year: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
  return { start, end };
}

function yearOf(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

type ReasonYearCounts = Record<string, { 2024: number; 2025: number; 2026: number }>;
type AssigneeStats = Record<string, ReasonYearCounts>;

/**
 * GET /api/sales-meeting/loss-analysis-stats
 *
 * レスポンス:
 * {
 *   data: {
 *     '林': { '①知り合い': { '2024': n, '2025': n, '2026': n }, ... },
 *     '麻': { ... },
 *     'K':  { ... }
 *   }
 * }
 */
router.get('/loss-analysis-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // 2024/1/1 〜 2026/12/31 の他決レコードを、必要カラムだけ取得
    const { start } = yearRange(2024);
    const { end } = yearRange(2026);

    const pageSize = 1000;
    let from = 0;
    const rows: Array<{
      status: string | null;
      visit_assignee: string | null;
      competitor_name_and_reason: string | null;
      competitor_name: string | null;
      contract_year_month: string | null;
    }> = [];

    for (;;) {
      const { data, error } = await supabase
        .from('sellers')
        .select('status, visit_assignee, competitor_name_and_reason, competitor_name, contract_year_month')
        .in('status', LOSS_STATUSES)
        .gte('contract_year_month', start)
        .lte('contract_year_month', end)
        .in('visit_assignee', TARGET_ASSIGNEES)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...(data as any));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // 集計器を初期化（対象担当者 × 全理由 × 3年 を 0 で用意）
    const stats: AssigneeStats = {};
    for (const a of TARGET_ASSIGNEES) {
      stats[a] = {};
      for (const r of REASONS) {
        stats[a][r] = { 2024: 0, 2025: 0, 2026: 0 };
      }
    }

    // 理由の照合キーを事前計算
    const reasonKeys = REASONS.map((r) => ({ reason: r, key: reasonMatchKey(r) }));

    for (const row of rows) {
      const assignee = (row.visit_assignee || '').trim();
      if (!TARGET_ASSIGNEES.includes(assignee)) continue;

      const year = yearOf(row.contract_year_month);
      if (year !== 2024 && year !== 2025 && year !== 2026) continue;

      // 理由テキスト（competitor_name_and_reason 優先、無ければ competitor_name）
      const reasonText = (row.competitor_name_and_reason || row.competitor_name || '').trim();

      // どの理由に該当するか判定（部分一致）。該当が無ければ「不明」に集計。
      let matched = '不明';
      if (reasonText) {
        const hit = reasonKeys.find((rk) => rk.key && reasonText.includes(rk.key));
        if (hit) matched = hit.reason;
      }

      (stats[assignee][matched] as any)[year] += 1;
    }

    res.json({ data: stats });
  } catch (error: any) {
    console.error('Failed to compute loss analysis stats:', error);
    res.status(500).json({ error: '他決分析集計の取得に失敗しました', details: error.message });
  }
});

export default router;
