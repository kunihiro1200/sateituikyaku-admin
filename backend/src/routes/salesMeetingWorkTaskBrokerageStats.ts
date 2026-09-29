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
 * 営業会議「売買仲介」ページ用: 業務依頼(work_tasks)ベースの件数・手数料集計
 *
 * 集計元: work_tasks
 *   - 対象   = settlement_date（決済日）に値があり、かつ「台帳作成済み」(ledger_created)に値がある行のみ
 *             ※ ledger_created が空の行は「決済予定（未確定）」であり、決済日欄に予定日が
 *               入っているだけのため集計しない（営業会議「契約集計」ページと母集団をそろえる）。
 *   - 月基準 = settlement_date（決済日）
 *   - 市区   = 物件番号(property_number)が「FI」を含めば福岡県。
 *             それ以外は property_address から 大分市 / 別府市 を判定。
 *             福岡でも大分でもない行（他県）は集計しない。
 *   - 種別   = property_type（戸/マ/土）。基本3種以外・未入力は集計から除外
 *   - 件数   = 上記条件を満たす1行で +1
 *   - countLow = 件数のうち売買価格(sales_price)が1000万円以下の件数
 *   - 手数料 = 入金確認が「確認済み」の側の通常仲介手数料(standard_brokerage_fee)を採用
 *       売のみ確認済み → 通常仲介手数料(売)
 *       買のみ確認済み → 通常仲介手数料(買)
 *       両方確認済み   → 売＋買を合算
 *       どちらも未確認 → 手数料0（件数にはカウントする）
 *     ※「確認済み」は厳密一致（"現金確認しました"等の自由記述は対象外）
 *
 * レスポンス: { data: { 'YYYY/M': { '大分市|戸建': { count, fee }, ... } } }
 *   フロント側で期（10月〜翌9月）に集約する。
 */

type CityKey = '大分市' | '別府市' | '福岡県';
type TypeKey = '戸建' | 'マンション' | '土地';

// 市区を判定する。集計対象は 大分市 / 別府市 / 福岡県 のみ。
// 物件番号(property_number)が「FI」を含めば福岡県。
// それ以外は property_address から 大分市 / 別府市 を判定。
// どれにも該当しない（＝福岡でも大分でもない）行は null を返し、集計から除外する。
function cityFromRow(propertyNumber: string | null, address: string | null): CityKey | null {
  const pn = (propertyNumber || '').toUpperCase();
  if (pn.includes('FI')) return '福岡県';
  const a = (address || '').trim();
  if (a.includes('大分市')) return '大分市';
  if (a.includes('別府市')) return '別府市';
  return null; // 他県（福岡でも大分でもない）はカウントしない
}

// property_type を集計上の種別(戸建/マンション/土地)に変換。該当しなければ null（集計対象外）。
function typeFromPropertyType(pt: string | null): TypeKey | null {
  const t = (pt || '').trim();
  if (!t) return null;
  if (t.includes('マンション') || t.startsWith('マ')) return 'マンション';
  if (t.includes('土地') || t.startsWith('土')) return '土地';
  if (t.includes('戸建') || t.startsWith('戸')) return '戸建';
  return null; // 店舗・事務所・倉庫 等は除外
}

// 日付文字列 → 'YYYY/M'（JST基準）
function ymFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}`;
}

// 「確認済み」の厳密判定
function isConfirmed(v: any): boolean {
  return String(v || '').trim() === '確認済み';
}

function toNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// 入金確認された側の通常仲介手数料を合算する。
//   売のみ確認 → 通常(売) / 買のみ確認 → 通常(買) / 両方 → 売＋買 / どちらも未確認 → 0
function pickFee(row: any): number {
  const sellerOk = isConfirmed(row.payment_confirmed_seller);
  const buyerOk = isConfirmed(row.payment_confirmed_buyer);
  let fee = 0;
  if (sellerOk) fee += toNum(row.standard_brokerage_fee_seller);
  if (buyerOk) fee += toNum(row.standard_brokerage_fee_buyer);
  return fee;
}

// count: 件数 / fee: 手数料 / countLow: 件数のうち売買価格が1000万円以下の件数
type Cell = { count: number; fee: number; countLow: number };
type MonthlyMap = Record<string, Record<string, Cell>>;

// 1000万円（以下判定のしきい値）
const LOW_PRICE_THRESHOLD = 10_000_000;

/**
 * GET /api/sales-meeting/worktask-brokerage-stats
 * レスポンス: { data: { 'YYYY/M': { '市区|種別': { count, fee, countLow } } } }
 *   countLow = その件数のうち、売買価格(sales_price)が1000万円以下の件数
 */
router.get('/worktask-brokerage-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('work_tasks')
        .select(
          'property_number, property_type, property_address, settlement_date, ledger_created, ' +
          'payment_confirmed_seller, payment_confirmed_buyer, ' +
          'standard_brokerage_fee_seller, standard_brokerage_fee_buyer, sales_price'
        )
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const monthly: MonthlyMap = {};

    for (const row of rows) {
      // 台帳作成済み（ledger_created に値がある）行のみ集計する。
      // 空欄は「決済予定（未確定）」で、決済日欄に予定日が入っているだけなので除外する。
      const ledger = (row.ledger_created ?? '').toString().trim();
      if (!ledger) continue;

      const ym = ymFromDate(row.settlement_date);
      if (!ym) continue; // 決済日が無い行は対象外

      const type = typeFromPropertyType(row.property_type);
      if (!type) continue; // 基本3種以外・未入力は除外

      const city = cityFromRow(row.property_number, row.property_address);
      if (!city) continue; // 福岡でも大分でもない行は集計しない（他県は不要）
      const fee = pickFee(row);
      const cellKey = `${city}|${type}`;

      if (!monthly[ym]) monthly[ym] = {};
      if (!monthly[ym][cellKey]) monthly[ym][cellKey] = { count: 0, fee: 0, countLow: 0 };
      monthly[ym][cellKey].count += 1;
      monthly[ym][cellKey].fee += fee;
      // 売買価格が1000万円以下なら countLow を+1（0や未入力は対象外）
      const price = toNum(row.sales_price);
      if (price > 0 && price <= LOW_PRICE_THRESHOLD) {
        monthly[ym][cellKey].countLow += 1;
      }
    }

    res.json({ data: monthly });
  } catch (error: any) {
    console.error('Failed to compute worktask brokerage stats:', error);
    res.status(500).json({ error: '業務依頼ベース売買仲介集計の取得に失敗しました', details: error.message });
  }
});

export default router;
