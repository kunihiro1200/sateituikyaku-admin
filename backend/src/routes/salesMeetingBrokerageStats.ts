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
 * 営業会議「売買仲介」ページ用: 売買仲介の実績集計（件数・仲介手数料）
 *
 * 集計元: property_listings テーブル
 *   - 成約種別 = status（状況）カラム。成約種別に該当する行のみ集計する
 *   - 月の基準 = contract_date（契約日）→ settlement_year_month → settlement_date → distribution_date
 *   - 市区    = address から「大分市」「別府市」を判定。どちらでもなければ「他県」
 *   - 種別    = property_type（戸/マ/土 等）→ 戸建 / マンション / 土地 / その他
 *   - 件数    = 成約1件で +1
 *   - 手数料  = total_commission（無ければ commission_from_seller + commission_from_buyer）
 *
 * 目的: 元スプレッドシートは暦年ごとの手入力だったが、
 *       DB に成約実績が入るようになった年（主に2026年以降）はここで自動集計する。
 *       レスポンスは年月キー（'YYYY/M'）→ 市区×種別ごとの { count, fee } を返し、
 *       フロント側で期（10月〜翌9月）に集約する。
 */

// 成約種別（status）として集計対象とみなす値。
// これ以外（空・「売止め」など）は成約ではないので集計しない。
const CONTRACT_STATUSES = new Set<string>([
  '専任両手', '専任片手',
  '一般両手', '一般片手', '一般他決',
  '他社物件片手', '他社物件両手',
  '自社買取（リースバック）', '自社買取（転売）',
  '買取紹介（片手）', '買取紹介（両手）',
]);

type CityKey = '大分市' | '別府市' | '他県';
type TypeKey = '戸建' | 'マンション' | '土地' | 'その他';

// address から市区を判定
function cityFromAddress(address: string | null): CityKey {
  const a = (address || '').trim();
  if (a.includes('大分市')) return '大分市';
  if (a.includes('別府市')) return '別府市';
  return '他県';
}

// property_type を集計上の種別に変換（戸/マ/土/その他）
function typeFromPropertyType(pt: string | null): TypeKey {
  const t = (pt || '').trim();
  if (!t) return 'その他';
  if (t.includes('マンション') || t.startsWith('マ')) return 'マンション';
  if (t.includes('土地') || t.startsWith('土')) return '土地';
  if (t.includes('戸建') || t.startsWith('戸')) return '戸建';
  return 'その他';
}

// 日付文字列 → 'YYYY/M'
function ymFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}`;
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

// 月の基準: 契約日 → 決済年月 → 決済日 → 配信日
function pickYm(row: any): string | null {
  return (
    ymFromDate(row.contract_date) ||
    ymFromYearMonth(row.settlement_year_month) ||
    ymFromDate(row.settlement_date) ||
    ymFromDate(row.distribution_date)
  );
}

// 手数料の取得: total_commission 優先。無ければ 売＋買。
function pickFee(row: any): number {
  const total = Number(row.total_commission);
  if (!isNaN(total) && total > 0) return total;
  const seller = Number(row.commission_from_seller) || 0;
  const buyer = Number(row.commission_from_buyer) || 0;
  return seller + buyer;
}

type Cell = { count: number; fee: number };
// 'YYYY/M' -> `${city}|${type}` -> Cell
type MonthlyMap = Record<string, Record<string, Cell>>;

/**
 * GET /api/sales-meeting/brokerage-stats
 *
 * クエリ: fromYm（省略時は 2026/1）以降のみ集計する
 * レスポンス: { data: { 'YYYY/M': { '大分市|戸建': { count, fee }, ... } } }
 */
router.get('/brokerage-stats', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();

    // 集計開始年月（デフォルト 2026/1）。それより前は手入力の静的データを使うため対象外。
    const fromYmStr = ymFromYearMonth(req.query.fromYm) || '2026/1';
    const [fy, fm] = fromYmStr.split('/').map(Number);
    const fromYmNum = fy * 12 + (fm - 1);

    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    for (;;) {
      const { data, error } = await supabase
        .from('property_listings')
        .select(
          'property_number, status, property_type, address, ' +
          'contract_date, settlement_date, settlement_year_month, distribution_date, ' +
          'total_commission, commission_from_seller, commission_from_buyer'
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
      const status = (row.status || '').trim();
      if (!CONTRACT_STATUSES.has(status)) continue; // 成約種別でない行は除外

      const ym = pickYm(row);
      if (!ym) continue;
      const [y, m] = ym.split('/').map(Number);
      if (y * 12 + (m - 1) < fromYmNum) continue; // 集計開始年月より前は対象外

      const city = cityFromAddress(row.address);
      const type = typeFromPropertyType(row.property_type);
      const fee = pickFee(row);
      const cellKey = `${city}|${type}`;

      if (!monthly[ym]) monthly[ym] = {};
      if (!monthly[ym][cellKey]) monthly[ym][cellKey] = { count: 0, fee: 0 };
      monthly[ym][cellKey].count += 1;
      monthly[ym][cellKey].fee += fee;
    }

    res.json({ data: monthly });
  } catch (error: any) {
    console.error('Failed to compute brokerage stats:', error);
    res.status(500).json({ error: '売買仲介集計の取得に失敗しました', details: error.message });
  }
});

export default router;
