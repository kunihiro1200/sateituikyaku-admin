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
 *   - AC列（状況（当社））= 他決/専任のステータス            → sellers.status
 *   - 理由（専任・他決要因）= 「①知り合い」等の丸数字付き     → sellers.exclusive_other_decision_factor
 *   - AM列（契約年月 他決は分かった時点）が対象年の範囲       → sellers.contract_year_month
 *   - AB列（営担）= 担当者名（林 / 麻 / K）                   → sellers.visit_assignee
 *
 * ※ 通話モードページの「ステータス（状況（当社））」「営担」「専任・他決要因」で判定する。
 * ※ 理由は表記ゆれに強くするため、先頭の丸数字（①〜㉔）だけで照合する。
 *
 * このAPIは特に「林 / 麻 / K」の担当者について、理由別・年別の
 * 専任件数（status = 専任媒介 / 他決→専任）と他決件数（status = 他決→追客 / 他決→追客不要）を返す。
 * （既存データが無い場合は 0 が返る＝新規担当者でも安全）
 */

// 他決とみなすステータス（元数式の AC列 条件 / 他決理由側）
const LOSS_STATUSES = ['他決→追客', '他決→追客不要'];

// 専任とみなすステータス（元数式の AC列 条件 / 専任理由側）
const SEN_STATUSES = ['専任媒介', '他決→専任'];

// 集計に必要な全ステータス（1回のクエリで両方取得する）
const ALL_STATUSES = [...LOSS_STATUSES, ...SEN_STATUSES];

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

// 丸数字 → REASONS のラベル への対応表（先頭の丸数字で引く）。
// 「不明」は丸数字を持たないので対象外（該当なし時のフォールバックに使う）。
const CIRCLED_TO_REASON: Record<string, string> = {};
for (const r of REASONS) {
  const ch = r.trim()[0];
  if ('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔'.includes(ch)) {
    CIRCLED_TO_REASON[ch] = r;
  }
}

// 丸数字（①〜㉔）の文字集合。理由の識別に使う。
// 売主リストの「専任・他決要因」(exclusive_other_decision_factor) は
// 「①知り合い」「⑫対応スピード」のように丸数字＋本文で保存されるため、
// 先頭の丸数字だけを取り出して照合する（本文の表記ゆれに強い）。
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔';

// 文字列の先頭にある丸数字を返す（無ければ null）
function leadingCircled(text: string): string | null {
  const t = text.trim();
  if (t.length === 0) return null;
  const ch = t[0];
  return CIRCLED.includes(ch) ? ch : null;
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

// 理由ごとに 専任 / 他決 それぞれの年別件数を持つ
type YearCounts = { 2024: number; 2025: number; 2026: number };
type ReasonCounts = Record<string, { sen: YearCounts; loss: YearCounts }>;
type AssigneeStats = Record<string, ReasonCounts>;

const emptyYearCounts = (): YearCounts => ({ 2024: 0, 2025: 0, 2026: 0 });

/**
 * GET /api/sales-meeting/loss-analysis-stats
 *
 * レスポンス:
 * {
 *   data: {
 *     '林': {
 *       '①知り合い': { sen: { '2024': n, '2025': n, '2026': n }, loss: { ... } },
 *       ...
 *     },
 *     '麻': { ... },
 *     'K':  { ... }
 *   }
 * }
 *
 * sen  = 専任理由側（status = 専任媒介 / 他決→専任）
 * loss = 他決理由側（status = 他決→追客 / 他決→追客不要）
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
      exclusive_other_decision_factor: string | null;
      contract_year_month: string | null;
    }> = [];

    for (;;) {
      const { data, error } = await supabase
        .from('sellers')
        .select('status, visit_assignee, exclusive_other_decision_factor, contract_year_month')
        .in('status', ALL_STATUSES)
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

    // 集計器を初期化（対象担当者 × 全理由 × {sen,loss} × 3年 を 0 で用意）
    const stats: AssigneeStats = {};
    for (const a of TARGET_ASSIGNEES) {
      stats[a] = {};
      for (const r of REASONS) {
        stats[a][r] = { sen: emptyYearCounts(), loss: emptyYearCounts() };
      }
    }

    for (const row of rows) {
      const assignee = (row.visit_assignee || '').trim();
      if (!TARGET_ASSIGNEES.includes(assignee)) continue;

      const year = yearOf(row.contract_year_month);
      if (year !== 2024 && year !== 2025 && year !== 2026) continue;

      const status = (row.status || '').trim();
      // 専任側か他決側か（どちらでもなければスキップ）
      let side: 'sen' | 'loss' | null = null;
      if (SEN_STATUSES.includes(status)) side = 'sen';
      else if (LOSS_STATUSES.includes(status)) side = 'loss';
      if (!side) continue;

      // 理由は「専任・他決要因」(exclusive_other_decision_factor) の先頭丸数字で判定する。
      // 例: 「①知り合い」→ ①。丸数字が無い/未記入は「不明」に集計。
      const factor = (row.exclusive_other_decision_factor || '').trim();
      const ch = leadingCircled(factor);
      const matched = (ch && CIRCLED_TO_REASON[ch]) ? CIRCLED_TO_REASON[ch] : '不明';

      (stats[assignee][matched][side] as any)[year] += 1;
    }

    res.json({ data: stats });
  } catch (error: any) {
    console.error('Failed to compute loss analysis stats:', error);
    res.status(500).json({ error: '他決分析集計の取得に失敗しました', details: error.message });
  }
});

export default router;
