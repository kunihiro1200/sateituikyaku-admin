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
 * 営業会議「契約集計」ページ用: FI物件の成約集計（2026/4以降）
 *
 * 集計元: property_listings テーブル
 *   - property_number（接頭辞 FI）
 *   - offer_status（買付＝成約種別：専任両手/専任片手/一般両手/一般片手/一般他決/
 *                   他社物件片手/他社物件両手/自社買取（リースバック）/自社買取（転売）/
 *                   買取紹介（片手）/買取紹介（両手） など）
 *   - 月の基準日: contract_date（契約日）→ offer_date（買付日）→
 *                 settlement_date（決済日）→ distribution_date（配信日【公開】）の優先で決定
 *
 * ※ FI物件は契約日が未入力のことが多いため、上記フォールバックで月を決める。
 * ※ 「買付」など成約種別として確定していない値・空は集計しない。
 */

// offer_status の値 → 集計キー
const STATUS_TO_KEY: Record<string, string> = {
  '専任両手': 'senRyo',
  '専任片手': 'senKata',
  '一般両手': 'ipRyo',
  '一般片手': 'ipKata',
  '一般他決': 'ipTa',
  '他社物件片手': 'otherKata',
  '他社物件両手': 'otherRyo',
  '自社買取（リースバック）': 'buyLB',
  '自社買取（転売）': 'buyResale',
  '買取紹介（片手）': 'refKata',
  '買取紹介（両手）': 'refRyo',
  '専任解除': 'senKaijo',
  '一般媒介解除': 'ipKaijo',
};

const EMPTY_COUNTS = () => ({
  senRyo: 0, senKata: 0, ipRyo: 0, ipKata: 0, ipTa: 0,
  otherKata: 0, otherRyo: 0, buyLB: 0, buyResale: 0,
  refKata: 0, refRyo: 0, senKaijo: 0, ipKaijo: 0,
});

function pickBaseDate(row: any): string | null {
  return row.contract_date || row.offer_date || row.settlement_date || row.distribution_date || null;
}

function ymKey(dateStr: string | null): string | null {
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

    // FI物件を必要カラムだけ取得（ページング）
    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('property_listings')
        .select('property_number, offer_status, contract_date, offer_date, settlement_date, distribution_date')
        .ilike('property_number', 'FI%')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const monthly: Record<string, ReturnType<typeof EMPTY_COUNTS>> = {};

    for (const row of rows) {
      const status = (row.offer_status || '').trim();
      const key = STATUS_TO_KEY[status];
      if (!key) continue; // 成約種別として集計対象でない（空・「買付」など）

      const ym = ymKey(pickBaseDate(row));
      if (!ym) continue;
      const [y, m] = ym.split('/').map(Number);
      if (y * 12 + (m - 1) < FROM_YM_NUM) continue; // 2026/4より前は対象外

      if (!monthly[ym]) monthly[ym] = EMPTY_COUNTS();
      (monthly[ym] as any)[key] += 1;
    }

    res.json({ data: monthly });
  } catch (error: any) {
    console.error('Failed to compute FI contract stats:', error);
    res.status(500).json({ error: 'FI成約集計の取得に失敗しました', details: error.message });
  }
});

export default router;
