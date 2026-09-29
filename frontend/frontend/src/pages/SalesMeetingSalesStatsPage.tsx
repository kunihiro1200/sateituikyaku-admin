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
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
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

// ---- 年（＝期の代表年）の一覧 ----
// 列は「期（決算期：10月〜翌9月）」を表す。数値は各期の代表年。
// 表示する期は 2024期・2025期・2026期の3期のみ（2020〜2023期は廃止）。
// いずれも業務依頼(work_tasks)から自動集計する（契約集計ページと同じ定義：
// 台帳作成済み・決済日ベース）。手入力の暦年データは使わない。
const YEARS = [2024, 2025, 2026] as const;
type Year = (typeof YEARS)[number];

// 業務依頼(work_tasks)の自動集計で上書きする期（代表年）。
// 全期を自動集計にそろえる（2024期も契約集計と同じくDB集計を使う）。
const DB_INJECT_YEARS: readonly Year[] = [2024, 2025, 2026];

// ---- 市区・種別の定義 ----
type CityKey = '大分市' | '別府市' | '福岡県' | '他県';
type TypeKey = '戸建' | 'マンション' | '土地' | '収益物件' | '店舗（事務所）';

// 件数は市区×基本3種別（戸建/マンション/土地）のみ
const COUNT_TYPES: TypeKey[] = ['戸建', 'マンション', '土地'];

// 手数料・単価の種別（店舗付住宅・空ビル（工場含）は削除）
const FEE_TYPES: TypeKey[] = [
  '戸建', 'マンション', '土地', '収益物件', '店舗（事務所）',
];

// 年→値 のマップ（欠損は0扱い）
type YearMap = Partial<Record<Year, number>>;

// ============================================================
// 件数（元シート「件数」ブロック）
// ============================================================
// 2024〜2026期は全て work_tasks から自動集計するため、手入力の土台データは持たない。
// （buildAllPeriodsLookup が対象期の列を DB 集計で完全上書きする）
const COUNTS: Record<CityKey, Partial<Record<TypeKey, YearMap>>> = {
  大分市: {},
  別府市: {},
  福岡県: {},
  他県: {},
};

// ============================================================
// 仲介手数料（元シート「仲介手数料」ブロック）
// ============================================================
// 手数料も全期 work_tasks 集計（入金確認済みの通常仲介手数料）を使うため手入力値は持たない。
const FEES: Record<CityKey, Partial<Record<TypeKey, YearMap>>> = {
  大分市: {},
  別府市: {},
  福岡県: {},
  他県: {},
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
// バックエンド /api/sales-meeting/worktask-brokerage-stats のレスポンス。
// 'YYYY/M' -> `${city}|${type}` -> { count, fee, countLow }
//   countLow = 件数のうち売買価格1000万円以下の件数
type DbCell = { count: number; fee: number; countLow: number };
type DbStats = Record<string, Record<string, DbCell>>;

// 期範囲（fiscalFrom〜fiscalTo）でDB集計を市区×種別ごとに合算する。
// 戻り値: `${city}|${type}` -> { count, fee, countLow }
function sumDbForFiscal(db: DbStats | null, from: string, to: string): Record<string, DbCell> {
  const out: Record<string, DbCell> = {};
  if (!db) return out;
  const f = ymNum(from);
  const t = ymNum(to);
  for (const [ym, cells] of Object.entries(db)) {
    const n = ymNum(ym);
    if (n < f || n > t) continue;
    for (const [cellKey, cell] of Object.entries(cells)) {
      if (!out[cellKey]) out[cellKey] = { count: 0, fee: 0, countLow: 0 };
      out[cellKey].count += cell.count;
      out[cellKey].fee += cell.fee;
      out[cellKey].countLow += (cell.countLow ?? 0);
    }
  }
  return out;
}

// 静的データ（COUNTS/FEES）に、DB集計をある「年」の値として重ねたルックアップを作る。
// dbYear に指定した年の列を、DB集計値で上書き（＝差し込み）する。
// これにより既存の v()/合計関数はそのまま使える。
type Lookup = Record<CityKey, Partial<Record<TypeKey, YearMap>>>;

// 全期間テーブル用: 静的データ（暦年＝各期の代表年）に、DB集計を「期範囲」で正しく振り分けて重ねる。
// 各期の代表年(PeriodDef.year)の列に、その期の会計期間(fiscalFrom〜fiscalTo)のDB集計を差し込む。
// これにより列は「期（決算期）」を表す（例: 2025列=2025期=2025/10〜2026/9、2026列=2026期=2026/10〜2027/9）。
function buildAllPeriodsLookup(
  base: Lookup,
  db: DbStats | null,
  metric: 'count' | 'fee' | 'countLow',
): Lookup {
  // countLow（うち1000万以下）は静的データの内訳が無いため、静的値は引き継がず空から作る。
  // count / fee は静的（手入力）データをディープコピーして土台にする。
  const out: Lookup = { 大分市: {}, 別府市: {}, 福岡県: {}, 他県: {} };
  if (metric !== 'countLow') {
    (Object.keys(base) as CityKey[]).forEach((city) => {
      const types = base[city];
      (Object.keys(types) as TypeKey[]).forEach((tk) => {
        out[city][tk] = { ...(types[tk] as YearMap) };
      });
    });
  }
  if (!db) return out;
  // 自動集計対象の期（DB_INJECT_YEARS）は、期範囲でwork_tasks集計してその代表年列に差し込む。
  // 手入力値が残らないよう、対象期の列は一旦クリアしてからDB値を入れる（自動集計で完全上書き）。
  for (const p of PERIOD_DEFS) {
    if (DB_INJECT_YEARS.indexOf(p.year) === -1) continue;
    // その期（代表年）の既存値をクリア
    (Object.keys(out) as CityKey[]).forEach((city) => {
      (Object.keys(out[city]) as TypeKey[]).forEach((tk) => {
        const m = out[city][tk] as YearMap;
        if (m && p.year in m) delete m[p.year];
      });
    });
    const agg = sumDbForFiscal(db, p.fiscalFrom, p.fiscalTo);
    for (const [cellKey, cell] of Object.entries(agg)) {
      const [city, type] = cellKey.split('|') as [CityKey, TypeKey];
      if (!out[city]) continue;
      if (!out[city][type]) out[city][type] = {};
      const val = metric === 'count' ? cell.count : metric === 'fee' ? cell.fee : cell.countLow;
      (out[city][type] as YearMap)[p.year] = val;
    }
  }
  return out;
}

// ---- ヘルパ ----
function v(map: YearMap | undefined, y: Year): number {
  return map?.[y] ?? 0;
}

// 列見出しの表示ラベル。期（決算期：10月〜翌9月）を分かりやすく
// 「YYYY年10月〜翌年9月（期）」形式で表示する。yは各期の代表年。
function yearColLabel(y: Year): string {
  return `${y}年10月〜${y + 1}年9月（期）`;
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
function CountTable({
  years, counts, countsLow, lowYears, colLabel, showTotal = true,
}: {
  years: Year[];
  counts: Lookup;
  countsLow?: Lookup;         // 件数のうち1000万円以下（あれば「（うち◯）」を併記）
  lowYears?: readonly Year[]; // 「うち◯」を表示する期（＝自動集計の期）
  colLabel?: (y: Year) => string;
  showTotal?: boolean;
}) {
  const cities: CityKey[] = ['大分市', '別府市', '福岡県'];
  const hdr = (y: Year) => (colLabel ? colLabel(y) : String(y));
  const showLow = (y: Year) => !!countsLow && !!lowYears && lowYears.indexOf(y) !== -1;
  // 件数 + （うち◯）の表示。lowが対象期のみ併記する。
  const cell = (count: number, low: number, y: Year) =>
    showLow(y) ? `${fmtNum(count)}（うち${fmtNum(low)}）` : fmtNum(count);
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{hdr(y)}</TableCell>
            ))}
            {showTotal && <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期合計</TableCell>}
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
                    <TableCell key={y} align="right">
                      {cell(v(counts[city][tk], y), countsLow ? v(countsLow[city]?.[tk], y) : 0, y)}
                    </TableCell>
                  ))}
                  {showTotal && (
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                      {fmtNum(years.reduce((s, y) => s + v(counts[city][tk], y), 0))}
                    </TableCell>
                  )}
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>
                    {cell(
                      cityCountTotal(counts, city, y),
                      countsLow ? cityCountTotal(countsLow, city, y) : 0,
                      y,
                    )}
                  </TableCell>
                ))}
                {showTotal && (
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtNum(years.reduce((s, y) => s + cityCountTotal(counts, city, y), 0))}
                  </TableCell>
                )}
              </TableRow>,
            ]
          ))}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>
                {cell(
                  grandCountTotal(counts, y),
                  countsLow ? grandCountTotal(countsLow, y) : 0,
                  y,
                )}
              </TableCell>
            ))}
            {showTotal && (
              <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                {fmtNum(years.reduce((s, y) => s + grandCountTotal(counts, y), 0))}
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================
// 仲介手数料テーブル
// ============================================================
function FeeTable({ years, fees, colLabel, showTotal = true }: { years: Year[]; fees: Lookup; colLabel?: (y: Year) => string; showTotal?: boolean }) {
  const cities: CityKey[] = ['大分市', '別府市', '福岡県', '他県'];
  const hdr = (y: Year) => (colLabel ? colLabel(y) : String(y));
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{hdr(y)}</TableCell>
            ))}
            {showTotal && <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期合計</TableCell>}
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
                  {showTotal && (
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                      {fmtYen(years.reduce((s, y) => s + v(fees[city][tk], y), 0))}
                    </TableCell>
                  )}
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(cityFeeTotal(fees, city, y))}</TableCell>
                ))}
                {showTotal && (
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtYen(years.reduce((s, y) => s + cityFeeTotal(fees, city, y), 0))}
                  </TableCell>
                )}
              </TableRow>,
            ];
          })}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(grandFeeTotal(fees, y))}</TableCell>
            ))}
            {showTotal && (
              <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                {fmtYen(years.reduce((s, y) => s + grandFeeTotal(fees, y), 0))}
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ============================================================
// 単価テーブル（＝手数料 ÷ 件数。件数がある種別のみ）
// ============================================================
function UnitTable({ years, counts, fees, colLabel, showTotal = true }: { years: Year[]; counts: Lookup; fees: Lookup; colLabel?: (y: Year) => string; showTotal?: boolean }) {
  const cities: CityKey[] = ['大分市', '別府市', '福岡県'];
  const hdr = (y: Year) => (colLabel ? colLabel(y) : String(y));
  return (
    <TableContainer component={Paper} sx={{ mb: 3 }}>
      <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow sx={{ bgcolor: '#ede7f6' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>市区</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>種別</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{hdr(y)}</TableCell>
            ))}
            {showTotal && <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>期平均</TableCell>}
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
                    {showTotal && (
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                        {fmtUnit(unitPrice(feeSum, cntSum))}
                      </TableCell>
                    )}
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
                {showTotal && (
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtUnit(unitPrice(
                      years.reduce((s, y) => s + cityFeeTotal(fees, city, y), 0),
                      years.reduce((s, y) => s + cityCountTotal(counts, city, y), 0),
                    ))}
                  </TableCell>
                )}
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
            {showTotal && (
              <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                {fmtUnit(unitPrice(
                  years.reduce((s, y) => s + grandFeeTotal(fees, y), 0),
                  years.reduce((s, y) => s + grandCountTotal(counts, y), 0),
                ))}
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

type Metric = 'count' | 'fee' | 'unit';

export default function SalesMeetingSalesStatsPage() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<Metric>('count');
  const [db, setDb] = useState<DbStats | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // 件数・手数料を業務依頼(work_tasks)から自動集計（決済日ベース）
  useEffect(() => {
    let cancelled = false;
    api.get('/api/sales-meeting/worktask-brokerage-stats')
      .then((res) => { if (!cancelled) setDb(res.data?.data ?? {}); })
      .catch(() => { if (!cancelled) setDb({}); })
      .finally(() => { if (!cancelled) setDbLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // 全期間の列 = 各期の代表年（=期）。DBは期範囲で振り分ける。
  const allYears = useMemo(() => [...YEARS], []);

  // 全期間表示用: 各年列を「期（決算期）」として扱い、DBは期範囲で正しく差し込む
  const allCounts = useMemo(
    () => buildAllPeriodsLookup(COUNTS as Lookup, db, 'count'),
    [db],
  );
  const allFees = useMemo(
    () => buildAllPeriodsLookup(FEES as Lookup, db, 'fee'),
    [db],
  );
  // 件数のうち売買価格1000万円以下（DB自動集計の期のみ値が入る）
  const allCountsLow = useMemo(
    () => buildAllPeriodsLookup(COUNTS as Lookup, db, 'countLow'),
    [db],
  );

  // 全期間の描画（列は期ごと。期合計/期平均列は非表示）
  const renderAll = () => {
    if (metric === 'count') return <CountTable years={allYears} counts={allCounts} countsLow={allCountsLow} lowYears={DB_INJECT_YEARS} colLabel={yearColLabel} showTotal={false} />;
    if (metric === 'fee') return <FeeTable years={allYears} fees={allFees} colLabel={yearColLabel} showTotal={false} />;
    return <UnitTable years={allYears} counts={allCounts} fees={allFees} colLabel={yearColLabel} showTotal={false} />;
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
          売買仲介の「件数」「仲介手数料」「単価（＝手数料÷件数）」を期（決算期：10月〜翌9月）ごとに集計しています。
          市区ごとの計・全社合計はこのページで自動計算しています。
          <b>2024期・2025期・2026期はいずれも業務依頼（決済日ベース・台帳作成済み）から自動集計</b>しています（契約集計ページと同じ母集団）。
          件数・手数料は「決済日が入っていて台帳作成済みの業務依頼」を種別（戸建/マンション/土地）で集計し、
          手数料は入金確認（売/買）が「確認済み」の側の通常仲介手数料を用います（両方確認済みは合算）。
          福岡県は物件番号にFIを含むものを集計します。
          件数タブの「（うち◯）」は、その件数のうち売買価格が1000万円以下の件数です（自動集計の期のみ）。
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

      {/* 全期間（期ごと。列は決算期） */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: PURPLE }}>
        全期間（{YEARS[0]}期〜{YEARS[YEARS.length - 1]}期）
      </Typography>
      {renderAll()}
    </Container>
  );
}
