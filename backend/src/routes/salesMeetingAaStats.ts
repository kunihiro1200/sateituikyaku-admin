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
 * 営業会議「契約集計」ページ用: AA（大分）の成約集計
 *
 * 集計元: 業務依頼(work_tasks) の「契約形態」(contract_type)
 *   - 契約形態 = 業務詳細 → 契約決済タブの「契約形態」フィールド
 *       専任両手 → 専任両手 / 専任片手 → 専任片手
 *       一般両手 → 一般両手 / 一般片手 → 一般片手
 *       他社物件片手 → 他社物件片手 / 他社物件両手 → 他社物件両手
 *       自社買取（リースバック）→ 自社買取LB / 自社買取（転売）→ 自社買取転売
 *       買取紹介（片手）→ 買取紹介片手 / 買取紹介（両手）→ 買取紹介両手
 *     ※ 全角/半角スペースや括弧の表記ゆれを吸収して正規化する。
 *   - 月の基準 = settlement_date（決済日）→ sales_contract_deadline（売買契約締め日）→ created_at
 *       決済日が入っていれば決済日ベース。無ければ契約締め日、それも無ければ登録日。
 *   - 集計対象 = 契約形態(contract_type)が集計対象の値である行すべて（台帳作成済みかどうかは問わない）。
 *
 * 加えて、以下の3項目は物件シート(property_listings)の「買付」(offer_status)と
 * 「状況」(status)から算出する（業務依頼の契約形態には現れないため）:
 *   - 一般他決(ipTa) / 専任解除(senKaijo) / 一般媒介解除(ipKaijo)
 *   - 買付・状況のどちらか一方でも該当値があれば1件として数える（両方一致でも二重計上しない）。
 *   - 月の基準 = contract_date（契約日）→ settlement_year_month（決済年月）→ settlement_date（決済日）→ distribution_date（配信日）
 *   - 他決率 = 一般他決 / (一般両手 + 一般片手 + 一般他決) はフロント側で再計算する。
 */

// contract_type（正規化後）→ 集計キー（フロントの Counts と同じキー体系）
const CONTRACT_TYPE_TO_KEY: Record<string, string> = {
  '専任両手': 'senRyo',
  '専任片手': 'senKata',
  '一般両手': 'ipRyo',
  '一般片手': 'ipKata',
  '他社物件片手': 'otherKata',
  '他社物件両手': 'otherRyo',
  '自社買取(リースバック)': 'buyLB',
  '自社買取(転売)': 'buyResale',
  '買取紹介(片手)': 'refKata',
  '買取紹介(両手)': 'refRyo',
};

const EMPTY_COUNTS = () => ({
  senRyo: 0, senKata: 0, ipRyo: 0, ipKata: 0, ipTa: 0,
  otherKata: 0, otherRyo: 0, buyLB: 0, buyResale: 0,
  refKata: 0, refRyo: 0, senKaijo: 0, ipKaijo: 0,
});

// contract_type の表記ゆれを吸収して正規化する。
// 例: 「専任　両手」「専任 両手」→「専任両手」
//     「自社買取（リースバック）」→「自社買取(リースバック)」
function normalizeContractType(raw: string): string {
  return raw
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')')) // 全角括弧→半角
    .replace(/[\s\u3000、,]/g, ''); // 空白（全半角）・読点・カンマを除去
}

// 日付文字列（ISO/日付）→ 'YYYY/M'（JST基準）。無効なら null。
function ymFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}`;
}

// 【業務依頼】月の基準: 決済日 → 売買契約締め日 → 登録日
function pickYmWorkTask(row: any): string | null {
  return (
    ymFromDate(row.settlement_date) ||
    ymFromDate(row.sales_contract_deadline) ||
    ymFromDate(row.created_at)
  );
}

// settlement_year_month（'2026/07'・'2026-07'・'2026年7月' 等）→ 'YYYY/M'
function ymFromYearMonth(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/(\d{4})\s*[/\-年.]\s*(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!y || !mo || mo < 1 || mo > 12) return null;
  return `${y}/${mo}`;
}

// 【物件シート】月の基準: 契約日 → 決済年月 → 決済日 → 配信日
function pickYmListing(row: any): string | null {
  return (
    ymFromDate(row.contract_date) ||
    ymFromYearMonth(row.settlement_year_month) ||
    ymFromDate(row.settlement_date) ||
    ymFromDate(row.distribution_date)
  );
}

// 物件シートの「買付」(offer_status)・「状況」(status)から
// 一般他決 / 専任解除 / 一般媒介解除 のいずれかに分類する。該当なしは null。
// 買付・状況どちらか一方でも該当すれば計上する（senKaijo→ipKaijo→ipTa の優先順）。
function classifyLossOrCancel(row: any): 'ipTa' | 'senKaijo' | 'ipKaijo' | null {
  const vals = [String(row.status || '').trim(), String(row.offer_status || '').trim()];
  const has = (x: string) => vals.includes(x);
  if (has('専任解除')) return 'senKaijo';
  if (has('一般媒介解除')) return 'ipKaijo';
  if (has('一般他決')) return 'ipTa';
  return null;
}

/**
 * GET /api/sales-meeting/aa-contract-stats
 * レスポンス: { data: { 'YYYY/M': { senRyo, senKata, ... } , ... } }
 */
router.get('/aa-contract-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // work_tasks を必要カラムだけ取得（ページング）
    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('work_tasks')
        .select('contract_type, settlement_date, sales_contract_deadline, created_at')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const monthly: Record<string, ReturnType<typeof EMPTY_COUNTS>> = {};

    for (const row of rows) {

      const raw = (row.contract_type || '').trim();
      if (!raw) continue;
      const key = CONTRACT_TYPE_TO_KEY[normalizeContractType(raw)];
      if (!key) continue; // 集計対象外の契約形態（自社売主 等）

      const ym = pickYmWorkTask(row);
      if (!ym) continue;

      if (!monthly[ym]) monthly[ym] = EMPTY_COUNTS();
      (monthly[ym] as any)[key] += 1;
    }

    // ---- 物件シート(property_listings) から 一般他決/専任解除/一般媒介解除 を集計 ----
    let listFrom = 0;
    const listRows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('property_listings')
        .select('status, offer_status, contract_date, settlement_date, settlement_year_month, distribution_date')
        .range(listFrom, listFrom + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      listRows.push(...data);
      if (data.length < pageSize) break;
      listFrom += pageSize;
    }

    for (const row of listRows) {
      const key = classifyLossOrCancel(row);
      if (!key) continue;

      const ym = pickYmListing(row);
      if (!ym) continue;

      if (!monthly[ym]) monthly[ym] = EMPTY_COUNTS();
      (monthly[ym] as any)[key] += 1;
    }

    res.json({ data: monthly });
  } catch (error: any) {
    console.error('Failed to compute AA(work_tasks) contract stats:', error);
    res.status(500).json({ error: 'AA(大分)成約集計の取得に失敗しました', details: error.message });
  }
});

export default router;
