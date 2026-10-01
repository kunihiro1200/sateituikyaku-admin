import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { buildEmployeeMaster } from '../utils/normalizeInitial';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );
}

/**
 * 営業会議「他決数推移」ページ用: 担当別の各指標を、売主DB（＋追客ログシート）から
 * 会計年度（10月〜翌9月）の月次で自動集計する。
 *
 * ■ 指標と集計基準（通話モードページ／既存ランキングAPIに準拠）
 *   - visitAssessment（訪問査定数）     : visit_assignee（営担）× visit_date（訪問日）
 *   - exclusive（専任媒介数）           : visit_assignee × status∈SEN × contract_year_month
 *   - loss（他決数）                    : visit_assignee × status∈LOSS × contract_year_month
 *   - general（一般媒介数）             : visit_assignee × status='一般媒介' × contract_year_month
 *   - firstCall（一番電話）             : first_call_person × inquiry_date
 *   - visitGet（訪問査定取得数）        : visit_valuation_acquirer × visit_acquisition_date
 *   - assessment（査定額算出）          : valuation_assignee × inquiry_date（反響日付）
 *   - followupCall（追客電話）          : Google Sheets「売主追客ログ」担当（前半/後半）× 日付
 *
 * ■ 担当（イニシャル）
 *   - employees マスタの現行イニシャルに normalize して集計する。
 *   - 旧イニシャル（employees に無い T/S/W/M/G/N 等）は集計対象外（捨てる）。
 *   - フルネーム（例: 国広智子）は normalize で現行イニシャル（K）に変換して含める。
 *
 * ■ 会計年度（期）
 *   - 1期 = 10月〜翌9月。終了年でラベル（FY2026 = 2025/10〜2026/9）。
 *   - 月スロットは 10月始まり（index 0=10月 … 11=9月）。
 *
 * ■ レスポンス
 * {
 *   data: {
 *     FY2022: { visitAssessment: { [initial]: number[12] }, exclusive: {...}, ... },
 *     ...
 *   },
 *   followupCallAvailable: boolean  // 追客ログシートが読めたか
 * }
 */

const LOSS_STATUSES = ['他決→追客', '他決→追客不要'];
const SEN_STATUSES = ['専任媒介', '他決→専任'];
const GENERAL_STATUSES = ['一般媒介'];

type PeriodKey = 'FY2022' | 'FY2023' | 'FY2024' | 'FY2025' | 'FY2026';
const PERIODS: PeriodKey[] = ['FY2022', 'FY2023', 'FY2024', 'FY2025', 'FY2026'];
const endYear = (p: PeriodKey): number => Number(p.slice(2));

type MetricKey =
  | 'visitAssessment'
  | 'exclusive'
  | 'loss'
  | 'lossFi' //        他決数のうち FI（福岡）売主限定・担当別
  | 'general'
  | 'firstCall'
  | 'visitGet'
  | 'assessment'
  | 'followupCall';

const METRICS: MetricKey[] = [
  'visitAssessment',
  'exclusive',
  'loss',
  'lossFi',
  'general',
  'firstCall',
  'visitGet',
  'assessment',
  'followupCall',
];

/** FI（福岡）売主かどうか。seller_number が 'FI' で始まる。 */
function isFi(sellerNumber: string | null): boolean {
  return (sellerNumber || '').toUpperCase().startsWith('FI');
}

/** 対象期間全体のISO日付範囲（最古の期の開始 〜 最新の期の終了） */
function overallRange(): { start: string; end: string } {
  const minEnd = endYear(PERIODS[0]);
  const maxEnd = endYear(PERIODS[PERIODS.length - 1]);
  return { start: `${minEnd - 1}-10-01`, end: `${maxEnd}-09-30` };
}

/** 暦年・暦月(1-12) → 会計期キー・会計月スロット(0=10月…11=9月)。対象外は null。 */
function fiscalSlot(calYear: number, calMonth: number): { period: PeriodKey; slot: number } | null {
  let end: number;
  let slot: number;
  if (calMonth >= 10) {
    end = calYear + 1;
    slot = calMonth - 10;
  } else {
    end = calYear;
    slot = calMonth + 2;
  }
  const period = `FY${end}` as PeriodKey;
  if (!PERIODS.includes(period)) return null;
  return { period, slot };
}

/** 日付文字列（"YYYY-MM-DD" や ISO）から暦年・暦月を取り出す（UTC基準） */
function parseYm(value: string | null): { year: number; month: number } | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

// stats[period][metric][initial] = number[12]
type StatsBucket = Record<PeriodKey, Record<MetricKey, Record<string, number[]>>>;

function emptyStats(): StatsBucket {
  const s = {} as StatsBucket;
  for (const p of PERIODS) {
    s[p] = {} as Record<MetricKey, Record<string, number[]>>;
    for (const m of METRICS) s[p][m] = {};
  }
  return s;
}

/** stats に 1件加算する。initial が有効な現行イニシャルのときだけ加算。 */
function addOne(
  stats: StatsBucket,
  metric: MetricKey,
  initial: string,
  period: PeriodKey,
  slot: number,
) {
  const bucket = stats[period][metric];
  if (!bucket[initial]) bucket[initial] = Array(12).fill(0);
  bucket[initial][slot] += 1;
}

/** sellers から全ページ取得する汎用ページャ */
async function fetchAll(
  supabase: any,
  columns: string,
  applyFilters: (q: any) => any,
): Promise<any[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];
  for (;;) {
    let q = supabase.from('sellers').select(columns).is('deleted_at', null);
    q = applyFilters(q);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * 追客電話（Google Sheets「売主追客ログ」）を全期間一括で読み、会計月別・担当別に集計する。
 * シートは1回だけ読む（当月フィルタはしない）。タイムアウト時は null を返す（＝追客電話は空のまま）。
 */
async function aggregateFollowupCalls(
  stats: StatsBucket,
  normalize: (raw: string) => string,
  initialSet: Set<string>,
): Promise<boolean> {
  try {
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const { sheetsRateLimiter } = await import('../services/RateLimiter');

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
      sheetName: '売主追客ログ',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await sheetsClient.authenticate();

    const rawData = await Promise.race([
      sheetsRateLimiter.executeRequest(async () => sheetsClient.readRawRange('A:G')),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ]);

    if (!rawData || rawData.length === 0) return false;

    const headers = rawData[0] as string[];
    const dateIdx = headers.findIndex((h) => h === '日付');
    const sellerIdx = headers.findIndex((h) => h === '売主番号');
    const firstHalfIdx = headers.findIndex((h) => h === '担当（前半）');
    const secondHalfIdx = headers.findIndex((h) => h === '担当（後半）');

    const dIdx = dateIdx >= 0 ? dateIdx : 0;
    const sIdx = sellerIdx >= 0 ? sellerIdx : 2;
    const fIdx = firstHalfIdx >= 0 ? firstHalfIdx : 4;
    const secIdx = secondHalfIdx >= 0 ? secondHalfIdx : 5;

    const seen = new Set<string>();

    for (const row of rawData.slice(1)) {
      const dateStr = row[dIdx];
      if (!dateStr) continue;

      // 日付と時刻（時）を解析（JSTローカル扱い）
      let year: number, month: number, day: number, hour = 0;
      try {
        const s = String(dateStr).trim();
        const slash = s.split('/');
        if (slash.length >= 3) {
          year = parseInt(slash[0], 10);
          month = parseInt(slash[1], 10);
          const dt = slash[2].split(' ');
          day = parseInt(dt[0], 10);
          if (dt[1]) hour = parseInt(dt[1].split(':')[0], 10) || 0;
        } else {
          const datePart = s.substring(0, 10);
          const [y, m, d] = datePart.split('-').map(Number);
          year = y; month = m; day = d;
          const t = s.substring(11, 13);
          if (t) hour = parseInt(t, 10) || 0;
        }
        if (!year || !month || !day) continue;
      } catch {
        continue;
      }

      const fs = fiscalSlot(year, month);
      if (!fs) continue;

      const sellerKey = row[sIdx] ? String(row[sIdx]).trim() : '';
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      for (const idx of [fIdx, secIdx]) {
        const raw = row[idx];
        if (!raw || String(raw).trim() === '') continue;
        const initial = normalize(String(raw).trim());
        if (!initialSet.has(initial)) continue; // 旧名義・未知は捨てる
        const dedupe = `${initial}_${sellerKey}_${dateKey}_${hour}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        addOne(stats, 'followupCall', initial, fs.period, fs.slot);
      }
    }
    return true;
  } catch (err) {
    console.warn('[LossStaffStats] 追客ログ集計をスキップ（非致命）:', err);
    return false;
  }
}

/**
 * GET /api/sales-meeting/loss-staff-stats
 */
router.get('/loss-staff-stats', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { start, end } = overallRange();
    const { normalize, initialSet } = await buildEmployeeMaster(supabase);

    const stats = emptyStats();

    // ---- status 系（営担 × contract_year_month）: 専任/他決/一般 を1回のクエリで ----
    const statusRows = await fetchAll(
      supabase,
      'visit_assignee, status, contract_year_month, seller_number',
      (q) =>
        q
          .in('status', [...SEN_STATUSES, ...LOSS_STATUSES, ...GENERAL_STATUSES])
          .gte('contract_year_month', start)
          .lte('contract_year_month', end),
    );
    for (const row of statusRows) {
      const ym = parseYm(row.contract_year_month);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;
      const initial = normalize(row.visit_assignee || '');
      if (!initialSet.has(initial)) continue;
      const status = (row.status || '').trim();
      let metric: MetricKey | null = null;
      if (SEN_STATUSES.includes(status)) metric = 'exclusive';
      else if (LOSS_STATUSES.includes(status)) metric = 'loss';
      else if (GENERAL_STATUSES.includes(status)) metric = 'general';
      if (!metric) continue;
      addOne(stats, metric, initial, fs.period, fs.slot);
      // 他決は FI（福岡）売主限定の担当別も別途集計する
      if (metric === 'loss' && isFi(row.seller_number)) {
        addOne(stats, 'lossFi', initial, fs.period, fs.slot);
      }
    }

    // ---- 訪問査定数（営担 × visit_date） ----
    const visitRows = await fetchAll(
      supabase,
      'visit_assignee, visit_date',
      (q) =>
        q
          .not('visit_assignee', 'is', null)
          .neq('visit_assignee', '')
          .gte('visit_date', start)
          .lte('visit_date', end),
    );
    for (const row of visitRows) {
      const ym = parseYm(row.visit_date);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;
      const initial = normalize(row.visit_assignee || '');
      if (!initialSet.has(initial)) continue;
      addOne(stats, 'visitAssessment', initial, fs.period, fs.slot);
    }

    // ---- 訪問査定取得数（訪問査定取得者 × visit_acquisition_date） ----
    const visitGetRows = await fetchAll(
      supabase,
      'visit_valuation_acquirer, visit_acquisition_date',
      (q) =>
        q
          .not('visit_valuation_acquirer', 'is', null)
          .neq('visit_valuation_acquirer', '')
          .gte('visit_acquisition_date', start)
          .lte('visit_acquisition_date', end),
    );
    for (const row of visitGetRows) {
      const ym = parseYm(row.visit_acquisition_date);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;
      const initial = normalize(row.visit_valuation_acquirer || '');
      if (!initialSet.has(initial)) continue;
      addOne(stats, 'visitGet', initial, fs.period, fs.slot);
    }

    // ---- 一番電話（first_call_person × inquiry_date） ----
    const firstCallRows = await fetchAll(
      supabase,
      'first_call_person, inquiry_date',
      (q) =>
        q
          .not('first_call_person', 'is', null)
          .neq('first_call_person', '')
          .gte('inquiry_date', start)
          .lte('inquiry_date', end),
    );
    for (const row of firstCallRows) {
      const ym = parseYm(row.inquiry_date);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;
      const initial = normalize(row.first_call_person || '');
      if (!initialSet.has(initial)) continue;
      addOne(stats, 'firstCall', initial, fs.period, fs.slot);
    }

    // ---- 査定額算出（valuation_assignee × inquiry_date〔反響日付〕） ----
    const assessmentRows = await fetchAll(
      supabase,
      'valuation_assignee, inquiry_date',
      (q) =>
        q
          .not('valuation_assignee', 'is', null)
          .neq('valuation_assignee', '')
          .gte('inquiry_date', start)
          .lte('inquiry_date', end),
    );
    for (const row of assessmentRows) {
      const ym = parseYm(row.inquiry_date);
      if (!ym) continue;
      const fs = fiscalSlot(ym.year, ym.month);
      if (!fs) continue;
      const initial = normalize(row.valuation_assignee || '');
      if (!initialSet.has(initial)) continue;
      addOne(stats, 'assessment', initial, fs.period, fs.slot);
    }

    // ---- 追客電話（Google Sheets、全期間一括） ----
    const followupCallAvailable = await aggregateFollowupCalls(stats, normalize, initialSet);

    res.json({ data: stats, followupCallAvailable });
  } catch (error: any) {
    console.error('Failed to compute loss staff stats:', error);
    res.status(500).json({ error: '担当別集計の取得に失敗しました', details: error.message });
  }
});

export default router;
