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
 *   - 集計対象 = 「台帳作成済み」(ledger_created)に値が入っている行のみ。
 *       ledger_created は日付フィールドで、台帳作成が済むと日付が入る。空欄は未作成なので集計しない。
 *
 * ※ 「一般他決」「専任解除」「一般解除」は業務依頼の契約形態には現れないため、
 *    この集計では 0 になる（それらは他決分析など別の集計元で扱う）。
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

// 月の基準: 決済日 → 売買契約締め日 → 登録日
function pickYm(row: any): string | null {
  return (
    ymFromDate(row.settlement_date) ||
    ymFromDate(row.sales_contract_deadline) ||
    ymFromDate(row.created_at)
  );
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
        .select('contract_type, settlement_date, sales_contract_deadline, created_at, ledger_created')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const monthly: Record<string, ReturnType<typeof EMPTY_COUNTS>> = {};

    for (const row of rows) {
      // 台帳作成済み（ledger_created に値がある）行のみ集計する。空欄は未作成なのでスキップ。
      const ledger = (row.ledger_created ?? '').toString().trim();
      if (!ledger) continue;

      const raw = (row.contract_type || '').trim();
      if (!raw) continue;
      const key = CONTRACT_TYPE_TO_KEY[normalizeContractType(raw)];
      if (!key) continue; // 集計対象外の契約形態（自社売主 等）

      const ym = pickYm(row);
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
