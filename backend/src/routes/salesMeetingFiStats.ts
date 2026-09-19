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
 * 営業会議「契約集計」ページ用: FI（福岡）の成約集計（2026/4以降）
 *
 * 集計元: 買主リスト(buyers) の「★最新状況」(latest_status)
 *   - 福岡の買主は buyer_number が「FK」で始まる（※売主はFIだが買主はFK）
 *   - 成約種別 = latest_status が「買（専任 両手）」等の値
 *       買（専任 両手）→ 専任両手 / 買（専任 片手）→ 専任片手
 *       買（一般 両手）→ 一般両手 / 買（一般 片手）→ 一般片手
 *       買（他社 片手）→ 他社物件片手 / 買（他社 両手）→ 他社物件両手
 *     ※ latest_status には全角/半角スペースの表記ゆれや「他社、片手」の読点表記があるため正規化する。
 *   - 月の基準 = viewing_date（●内覧日(最新)）
 *
 * ※ 「一般他決」など買主リストに現れない種別は、この集計では 0 になる。
 * ※ 成約種別でない latest_status（確度ランクC/D、AZ/BZ、不明 等）は集計しない。
 */

// latest_status（正規化後）→ 集計キー
const STATUS_TO_KEY: Record<string, string> = {
  '買(専任両手)': 'senRyo',
  '買(専任片手)': 'senKata',
  '買(一般両手)': 'ipRyo',
  '買(一般片手)': 'ipKata',
  '買(他社両手)': 'otherRyo',
  '買(他社片手)': 'otherKata',
};

const EMPTY_COUNTS = () => ({
  senRyo: 0, senKata: 0, ipRyo: 0, ipKata: 0, ipTa: 0,
  otherKata: 0, otherRyo: 0, buyLB: 0, buyResale: 0,
  refKata: 0, refRyo: 0, senKaijo: 0, ipKaijo: 0,
});

// latest_status の表記ゆれを吸収して正規化する。
// 例: 「買（専任　両手）」「買（専任 両手）」→「買(専任両手)」
//     「買（他社、片手）」「買（他社　片手）」→「買(他社片手)」
function normalizeStatus(raw: string): string {
  return raw
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')')) // 全角括弧→半角
    .replace(/[\s\u3000、,]/g, ''); // 空白（全半角）・読点・カンマを除去
}

function ymFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
}

const FROM_YM_NUM = 2026 * 12 + (4 - 1); // 2026/4

/**
 * GET /api/sales-meeting/fi-contract-stats
 * レスポンス: { data: { 'YYYY/M': { senRyo, senKata, ... } , ... } }
 */
router.get('/fi-contract-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // FK買主（福岡）を必要カラムだけ取得（ページング）
    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('buyers')
        .select('buyer_number, latest_status, viewing_date')
        .ilike('buyer_number', 'FK%')
        .is('deleted_at', null)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const monthly: Record<string, ReturnType<typeof EMPTY_COUNTS>> = {};

    for (const row of rows) {
      const raw = (row.latest_status || '').trim();
      if (!raw) continue;
      const key = STATUS_TO_KEY[normalizeStatus(raw)];
      if (!key) continue; // 成約種別でない（確度ランク・不明など）

      const ym = ymFromDate(row.viewing_date);
      if (!ym) continue;
      const [y, m] = ym.split('/').map(Number);
      if (y * 12 + (m - 1) < FROM_YM_NUM) continue; // 2026/4より前は対象外

      if (!monthly[ym]) monthly[ym] = EMPTY_COUNTS();
      (monthly[ym] as any)[key] += 1;
    }

    res.json({ data: monthly });
  } catch (error: any) {
    console.error('Failed to compute FI(FK) contract stats:', error);
    res.status(500).json({ error: 'FI(福岡)成約集計の取得に失敗しました', details: error.message });
  }
});

export default router;
