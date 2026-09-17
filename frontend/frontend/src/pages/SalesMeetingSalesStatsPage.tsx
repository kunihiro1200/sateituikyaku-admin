import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * 営業会議「売買仲介」ページ
 *
 * 共有ページの営業会議カテゴリーに追加する売買仲介の集計。
 * - 件数（市区／種別ごと）
 * - 仲介手数料（市区／種別ごと）
 * - 単価（＝仲介手数料 ÷ 件数。このページで自動計算）
 *
 * 集計・合計はすべてこのページで自動計算する。
 * 年ごとの生データを持ち、年をまたぐ「期（決算期：10月〜翌9月ではなく年単位）」ではなく
 * 元シートに合わせて「年（暦年）」単位で保持し、市区・全社の合計を自動で再集計する。
 */

// ---- 年の一覧（元シートの列 + DB自動集計の2026） ----
// 2020〜2025 は元スプレッドシートの手入力（暦年）。
// 2026 は DB（property_listings）から自動集計する。
const STATIC_YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
const DB_YEARS = [2026] as const;
const YEARS = [...STATIC_YEARS, ...DB_YEARS] as const;
type Year = (typeof YEARS)[number];

// ---- 市区・種別の定義 ----
type CityKey = '大分市' | '別府市' | '他県';
type TypeKey = '戸建' | 'マンション' | '土地' | '店舗付住宅' | '収益物件' | '空ビル（工場含）' | '店舗（事務所）';

// 件数は市区×基本3種別（戸建/マンション/土地）のみ元シートに存在
const COUNT_TYPES: TypeKey[] = ['戸建', 'マンション', '土地'];

// 手数料・単価は種別が多い（大分市/別府市のみ全種別、他県は戸建のみ）
const FEE_TYPES: TypeKey[] = [
  '戸建', 'マンション', '土地', '店舗付住宅', '収益物件', '空ビル（工場含）', '店舗（事務所）',
];

// 年→値 のマップ（欠損は0扱い）
type YearMap = Partial<Record<Year, number>>;

// ============================================================
// 件数（元シート「件数」ブロック）
// ============================================================
const COUNTS: Record<CityKey, Partial<Record<TypeKey, YearMap>>> = {
  大分市: {
    戸建:      { 2020: 33, 2021: 34, 2022: 27, 2023: 50, 2024: 38, 2025: 49 },
    マンション: { 2020: 21, 2021: 12, 2022: 13, 2023: 16, 2024: 20, 2025: 19 },
    土地:      { 2020: 13, 2021: 25, 2022: 27, 2023: 28, 2024: 29, 2025: 23 },
  },
  別府市: {
    戸建:      { 2020: 16, 2021: 17, 2022: 12, 2023: 14, 2024: 17, 2025: 22 },
    マンション: { 2020: 6,  2021: 10, 2022: 9,  2023: 12, 2024: 14, 2025: 5 },
    土地:      { 2020: 5,  2021: 5,  2022: 7,  2023: 7,  2024: 16, 2025: 8 },
  },
  他県: {},
};

// ============================================================
// 仲介手数料（元シート「仲介手数料」ブロック）
// ============================================================
const FEES: Record<CityKey, Partial<Record<TypeKey, YearMap>>> = {
  大分市: {
    戸建:              { 2020: 13675200, 2021: 23778150, 2022: 21183585, 2023: 43284650, 2024: 29072100, 2025: 56383310 },
    マンション:         { 2020: 16783364, 2021: 9436600,  2022: 5292100,  2023: 12883518, 2024: 11829400, 2025: 19569000 },
    土地:              { 2020: 6960300,  2021: 19953450, 2022: 24616380, 2023: 26579300, 2024: 19806600, 2025: 33177540 },
    店舗付住宅:         { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    収益物件:          { 2020: 11352000, 2021: 0, 2022: 0, 2023: 0, 2024: 3240600, 2025: 0 },
    '空ビル（工場含）': { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    '店舗（事務所）':   { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 660000 },
  },
  別府市: {
    戸建:              { 2020: 6425600, 2021: 11768900, 2022: 6815600, 2023: 10716200, 2024: 0, 2025: 26238200 },
    マンション:         { 2020: 2115300, 2021: 3466700,  2022: 5159636, 2023: 7595500,  2024: 0, 2025: 10567800 },
    土地:              { 2020: 1529000, 2021: 2030600,  2022: 3892680, 2023: 1772100,  2024: 5920860, 2025: 13296656 },
    店舗付住宅:         { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    収益物件:          { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    '空ビル（工場含）': { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    '店舗（事務所）':   { 2020: 0, 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
  },
  他県: {
    戸建: { 2020: 1782000 },
  },
};

// ---- 期（決算期：10月〜翌9月） ----
// 例: 2025期 = 2025年10月〜2026年9月
//
// 注意:
//   - 2020〜2025 の静的データは「暦年」単位でしか持っていないため、
//     各期には「その期の開始年の暦年データ」を代表値として割り当てる（近似）。
//     例: 2025期（2025/10〜2026/9）→ 2025年の暦年データ + 2026年のDB集計（10〜9で正確に切る）
//   - 2026 は DB から月別で取得するため、期範囲（10〜翌9）で正確に集計する。
//
// year: この期に紐づく静的な暦年（近似の代表年）
// fiscalFrom/fiscalTo: 'YYYY/M'。DB集計（2026）を期範囲で正確に切るための境界
type PeriodDef = {
  key: string;
  label: string;
  year: Year;            // 静的データの代表年（暦年）
  fiscalFrom: string;    // 期の開始 'YYYY/M'
  fiscalTo: string;      // 期の終了 'YYYY/M'
};
const PERIOD_DEFS: PeriodDef[] = [
  { key: '2020', label: '2020年10月〜2021年9月（期）', year: 2020, fiscalFrom: '2020/10', fiscalTo: '2021/9' },
  { key: '2021', label: '2021年10月〜2022年9月（期）', year: 2021, fiscalFrom: '2021/10', fiscalTo: '2022/9' },
  { key: '2022', label: '2022年10月〜2023年9月（期）', year: 2022, fiscalFrom: '2022/10', fiscalTo: '2023/9' },
  { key: '2023', label: '2023年10月〜2024年9月（期）', year: 2023, fiscalFrom: '2023/10', fiscalTo: '2024/9' },
  { key: '2024', label: '2024年10月〜2025年9月（期）', year: 2024, fiscalFrom: '2024/10', fiscalTo: '2025/9' },
  { key: '2025', label: '2025年10月〜2026年9月（期）', year: 2025, fiscalFrom: '2025/10', fiscalTo: '2026/9' },
  { key: '2026', label: '2026年10月〜2027年9月（期）', year: 2026, fiscalFrom: '2026/10', fiscalTo: '2027/9' },
];

// 'YYYY/M' を連番（年*12+月）に変換。期範囲の判定に使う。
function ymNum(ym: string): number {
  const [y, m] = ym.split('/').map(Number);
  return y * 12 + (m - 1);
}

// ============================================================
// DB自動集計（2026〜）の型とマージ処理
// ============================================================
// バックエンド /api/sales-meeting/brokerage-stats のレスポンス。
// 'YYYY/M' -> `${city}|${type}` -> { count, fee }
type DbCell = { count: number; fee: number };
type DbStats = Record<string, Record<string, DbCell>>;

// 期範囲（fiscalFrom〜fiscalTo）でDB集計を市区×種別ごとに合算する。
// 戻り値: `${city}|${type}` -> { count, fee }
function sumDbForFiscal(db: DbStats | null, from: string, to: string): Record<string, DbCell> {
  const out: Record<string, DbCell> = {};
  if (!db) return out;
  const f = ymNum(from);
  const t = ymNum(to);
  for (const [ym, cells] of Object.entries(db)) {
    const n = ymNum(ym);
    if (n < f || n > t) continue;
    for (const [cellKey, cell] of Object.entries(cells)) {
      if (!out[cellKey]) out[cellKey] = { count: 0, fee: 0 };
      out[cellKey].count += cell.count;
      out[cellKey].fee += cell.fee;
    }
  }
  return out;
}

// 静的データ（COUNTS/FEES）に、DB集計をある「年」の値として重ねたルックアップを作る。
// dbYear に指定した年の列を、DB集計値で上書き（＝差し込み）する。
// これにより既存の v()/合計関数はそのまま使える。
type Lookup = Record<CityKey, Partial<Record<TypeKey, YearMap>>>;

function buildLookup(
  base: Lookup,
  dbYear: Year | null,
  dbAgg: Record<string, DbCell>,
  metric: 'count' | 'fee',
): Lookup {
  // ディープコピー
  const out: Lookup = { 大分市: {}, 別府市: {}, 他県: {} };
  (Object.keys(base) as CityKey[]).forEach((city) => {
    const types = base[city];
    (Object.keys(types) as TypeKey[]).forEach((tk) => {
      out[city][tk] = { ...(types[tk] as YearMap) };
    });
  });
  if (dbYear === null) return out;
  // DB集計をその年の列として差し込む
  for (const [cellKey, cell] of Object.entries(dbAgg)) {
    const [city, type] = cellKey.split('|') as [CityKey, TypeKey];
    if (!out[city]) continue;
    if (!out[city][type]) out[city][type] = {};
    (out[city][type] as YearMap)[dbYear] = metric === 'count' ? cell.count : cell.fee;
  }
  return out;
}

// ---- ヘルパ ----
function v(map: YearMap | undefined, y: Year): number {
  return map?.[y] ?? 0;
}

function fmtNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

function fmtYen(n: number): string {
  return '¥' + n.toLocaleString('ja-JP');
}

// 市区の年合計（件数）
function cityCountTotal(counts: Lookup, city: CityKey, y: Year): number {
  const t = counts[city];
  return COUNT_TYPES.reduce((s, tk) => s + v(t[tk], y), 0);
}

// 全市区・全種別の年合計（件数）
function grandCountTotal(counts: Lookup, y: Year): number {
  return (Object.keys(counts) as CityKey[]).reduce((s, city) => s + cityCountTotal(counts, city, y), 0);
}

// 市区の年合計（手数料）
function cityFeeTotal(fees: Lookup, city: CityKey, y: Year): number {
  const t = fees[city];
  return FEE_TYPES.reduce((s, tk) => s + v(t[tk], y), 0);
}

// 全市区の年合計（手数料）
function grandFeeTotal(fees: Lookup, y: Year): number {
  return (Object.keys(fees) as CityKey[]).reduce((s, city) => s + cityFeeTotal(fees, city, y), 0);
}

// 単価 = 手数料 ÷ 件数（件数0のときはnull）
function unitPrice(fee: number, count: number): number | null {
  return count > 0 ? fee / count : null;
}
function fmtUnit(u: number | null): string {
  if (u === null) return '—';
  return fmtYen(Math.round(u));
}

const PURPLE = '#6a1b9a';

// ============================================================
// 件数テーブル
// ============================================================
function CountTable({ years, counts }: { years: Year[]; counts: Lookup }) {
  const cities: CityKey[] = ['大分市', '別府市'];
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{y}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期合計</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cities.map((city) => (
            [
              ...COUNT_TYPES.map((tk, i) => (
                <TableRow key={`${city}-${tk}`} hover sx={i === 0 ? { '& td': { borderTop: '2px solid #9575cd' } } : undefined}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{i === 0 ? city : ''}</TableCell>
                  <TableCell>{tk}</TableCell>
                  {years.map((y) => (
                    <TableCell key={y} align="right">{fmtNum(v(counts[city][tk], y))}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtNum(years.reduce((s, y) => s + v(counts[city][tk], y), 0))}
                  </TableCell>
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtNum(cityCountTotal(counts, city, y))}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtNum(years.reduce((s, y) => s + cityCountTotal(counts, city, y), 0))}
                </TableCell>
              </TableRow>,
            ]
          ))}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtNum(grandCountTotal(counts, y))}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtNum(years.reduce((s, y) => s + grandCountTotal(counts, y), 0))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================
// 仲介手数料テーブル
// ============================================================
function FeeTable({ years, fees }: { years: Year[]; fees: Lookup }) {
  const cities: CityKey[] = ['大分市', '別府市', '他県'];
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{y}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期合計</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cities.map((city) => {
            // 他県は戸建のみなので、値が入っている種別だけ表示
            const typesForCity = FEE_TYPES.filter((tk) =>
              years.some((y) => v(fees[city][tk], y) !== 0) || (fees[city][tk] !== undefined),
            );
            const shown = typesForCity.length ? typesForCity : ['戸建' as TypeKey];
            return [
              ...shown.map((tk, i) => (
                <TableRow key={`${city}-${tk}`} hover sx={i === 0 ? { '& td': { borderTop: '2px solid #9575cd' } } : undefined}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{i === 0 ? city : ''}</TableCell>
                  <TableCell>{tk}</TableCell>
                  {years.map((y) => (
                    <TableCell key={y} align="right">{fmtYen(v(fees[city][tk], y))}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtYen(years.reduce((s, y) => s + v(fees[city][tk], y), 0))}
                  </TableCell>
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(cityFeeTotal(fees, city, y))}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtYen(years.reduce((s, y) => s + cityFeeTotal(fees, city, y), 0))}
                </TableCell>
              </TableRow>,
            ];
          })}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(grandFeeTotal(fees, y))}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtYen(years.reduce((s, y) => s + grandFeeTotal(fees, y), 0))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================
// 単価テーブル（＝手数料 ÷ 件数。件数がある種別のみ）
// ============================================================
function UnitTable({ years, counts, fees }: { years: Year[]; counts: Lookup; fees: Lookup }) {
  const cities: CityKey[] = ['大分市', '別府市'];
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{y}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期平均</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cities.map((city) => (
            [
              ...COUNT_TYPES.map((tk, i) => {
                const feeSum = years.reduce((s, y) => s + v(fees[city][tk], y), 0);
                const cntSum = years.reduce((s, y) => s + v(counts[city][tk], y), 0);
                return (
                  <TableRow key={`${city}-${tk}`} hover sx={i === 0 ? { '& td': { borderTop: '2px solid #9575cd' } } : undefined}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{i === 0 ? city : ''}</TableCell>
                    <TableCell>{tk}</TableCell>
                    {years.map((y) => (
                      <TableCell key={y} align="right">
                        {fmtUnit(unitPrice(v(fees[city][tk], y), v(counts[city][tk], y)))}
                      </TableCell>
                    ))}
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                      {fmtUnit(unitPrice(feeSum, cntSum))}
                    </TableCell>
                  </TableRow>
                );
              }),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 平均</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>
                    {fmtUnit(unitPrice(cityFeeTotal(fees, city, y), cityCountTotal(counts, city, y)))}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtUnit(unitPrice(
                    years.reduce((s, y) => s + cityFeeTotal(fees, city, y), 0),
                    years.reduce((s, y) => s + cityCountTotal(counts, city, y), 0),
                  ))}
                </TableCell>
              </TableRow>,
            ]
          ))}
          {/* 全社平均 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 平均</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>
                {fmtUnit(unitPrice(grandFeeTotal(fees, y), grandCountTotal(counts, y)))}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtUnit(unitPrice(
                years.reduce((s, y) => s + grandFeeTotal(fees, y), 0),
                years.reduce((s, y) => s + grandCountTotal(counts, y), 0),
              ))}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type Metric = 'count' | 'fee' | 'unit';

// DB集計を差し込む対象の年（2026）。DB_YEARS の先頭。
const DB_TARGET_YEAR: Year = DB_YEARS[0];

export default function SalesMeetingSalesStatsPage() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('count');
  const [expandedPeriod, setExpandedPeriod] = useState<string>('2025');
  const [db, setDb] = useState<DbStats | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // 2026年分をDBから自動集計（property_listings）
  useEffect(() => {
    let cancelled = false;
    api.get('/api/sales-meeting/brokerage-stats', { params: { fromYm: '2026/1' } })
      .then((res) => { if (!cancelled) setDb(res.data?.data ?? {}); })
      .catch(() => { if (!cancelled) setDb({}); })
      .finally(() => { if (!cancelled) setDbLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // 全期間（全年）の合計を出すためのヘルパ
  const allYears = useMemo(() => [...YEARS], []);

  // 全期間表示用: 2026年は暦年（2026/1〜2026/12）でDB集計を差し込む
  const allYearsDbAgg = useMemo(
    () => sumDbForFiscal(db, '2026/1', '2026/12'),
    [db],
  );
  const allCounts = useMemo(
    () => buildLookup(COUNTS as Lookup, DB_TARGET_YEAR, allYearsDbAgg, 'count'),
    [allYearsDbAgg],
  );
  const allFees = useMemo(
    () => buildLookup(FEES as Lookup, DB_TARGET_YEAR, allYearsDbAgg, 'fee'),
    [allYearsDbAgg],
  );

  // 全期間の描画（2026列にDB暦年集計を差し込んだルックアップを使用）
  const renderAll = () => {
    if (metric === 'count') return <CountTable years={allYears} counts={allCounts} />;
    if (metric === 'fee') return <FeeTable years={allYears} fees={allFees} />;
    return <UnitTable years={allYears} counts={allCounts} fees={allFees} />;
  };

  // 期別の描画: その期の代表年1列のみ。
  // 2026列を含む期は、期範囲（10〜翌9）でDB集計を正確に切って差し込む。
  const renderPeriod = (p: PeriodDef) => {
    const years: Year[] = [p.year];
    // この期に2026列が含まれるか（＝代表年がDB対象年）
    const dbYear = p.year === DB_TARGET_YEAR ? DB_TARGET_YEAR : null;
    const dbAgg = dbYear ? sumDbForFiscal(db, p.fiscalFrom, p.fiscalTo) : {};
    const counts = buildLookup(COUNTS as Lookup, dbYear, dbAgg, 'count');
    const fees = buildLookup(FEES as Lookup, dbYear, dbAgg, 'fee');
    if (metric === 'count') return <CountTable years={years} counts={counts} />;
    if (metric === 'fee') return <FeeTable years={years} fees={fees} />;
    return <UnitTable years={years} counts={counts} fees={fees} />;
  };

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/shared-items')}
          size="small"
          sx={{ color: PURPLE }}
        >
          共有一覧へ戻る
        </Button>
        <Typography variant="h5" fontWeight="bold" sx={{ color: PURPLE }}>
          営業会議 売買仲介
        </Typography>
        {!dbLoaded && <Chip size="small" label="2026年 集計を読み込み中…" />}
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f3e5f5' }}>
        <Typography variant="body2" sx={{ color: PURPLE }}>
          売買仲介の「件数」「仲介手数料」「単価（＝手数料÷件数）」を集計しています。
          市区ごとの計・全社合計・期合計はすべてこのページで自動計算しています。
          2020〜2025年は手入力の実績、<b>2026年はDB（物件リスト）から自動集計</b>しています。
          期は決算期（10月〜翌9月。例：2025期＝2025年10月〜2026年9月）で分けて表示します。
        </Typography>
      </Paper>

      <ToggleButtonGroup
        value={metric}
        exclusive
        onChange={(_, val) => { if (val) setMetric(val); }}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="count">件数</ToggleButton>
        <ToggleButton value="fee">仲介手数料</ToggleButton>
        <ToggleButton value="unit">単価</ToggleButton>
      </ToggleButtonGroup>

      {/* 全期間合計 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: PURPLE }}>
        全期間（{YEARS[0]}〜{YEARS[YEARS.length - 1]}年）
      </Typography>
      {renderAll()}

      {/* 期別 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mt: 3, mb: 1, color: PURPLE }}>
        期別（決算期：10月〜翌9月）
      </Typography>
      {[...PERIOD_DEFS].reverse().map((p) => (
        <Accordion
          key={p.key}
          expanded={expandedPeriod === p.key}
          onChange={() => setExpandedPeriod(expandedPeriod === p.key ? '' : p.key)}
          disableGutters
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#ede7f6' }}>
            <Typography fontWeight="bold" sx={{ color: PURPLE }}>{p.label}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {renderPeriod(p)}
          </AccordionDetails>
        </Accordion>
      ))}
    </Container>
  );
}
