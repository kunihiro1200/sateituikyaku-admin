import { useMemo, useState } from 'react';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

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

// ---- 年の一覧（元シートの列） ----
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
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

// ---- 期（元シートに合わせて年単位でグルーピング） ----
// 元シートは暦年の列。ここでは「前半期（2020〜2022）／後半期（2023〜2025）」に分けて表示する。
const PERIOD_DEFS: { key: string; label: string; years: Year[] }[] = [
  { key: 'p1', label: '前期（2020〜2022年）', years: [2020, 2021, 2022] },
  { key: 'p2', label: '後期（2023〜2025年）', years: [2023, 2024, 2025] },
];

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
function cityCountTotal(city: CityKey, y: Year): number {
  const t = COUNTS[city];
  return COUNT_TYPES.reduce((s, tk) => s + v(t[tk], y), 0);
}

// 全市区・全種別の年合計（件数）
function grandCountTotal(y: Year): number {
  return (Object.keys(COUNTS) as CityKey[]).reduce((s, city) => s + cityCountTotal(city, y), 0);
}

// 市区の年合計（手数料）
function cityFeeTotal(city: CityKey, y: Year): number {
  const t = FEES[city];
  return FEE_TYPES.reduce((s, tk) => s + v(t[tk], y), 0);
}

// 全市区の年合計（手数料）
function grandFeeTotal(y: Year): number {
  return (Object.keys(FEES) as CityKey[]).reduce((s, city) => s + cityFeeTotal(city, y), 0);
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
function CountTable({ years }: { years: Year[] }) {
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
                    <TableCell key={y} align="right">{fmtNum(v(COUNTS[city][tk], y))}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtNum(years.reduce((s, y) => s + v(COUNTS[city][tk], y), 0))}
                  </TableCell>
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtNum(cityCountTotal(city, y))}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtNum(years.reduce((s, y) => s + cityCountTotal(city, y), 0))}
                </TableCell>
              </TableRow>,
            ]
          ))}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtNum(grandCountTotal(y))}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtNum(years.reduce((s, y) => s + grandCountTotal(y), 0))}
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
function FeeTable({ years }: { years: Year[] }) {
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
              years.some((y) => v(FEES[city][tk], y) !== 0) || (FEES[city][tk] !== undefined),
            );
            const shown = typesForCity.length ? typesForCity : ['戸建' as TypeKey];
            return [
              ...shown.map((tk, i) => (
                <TableRow key={`${city}-${tk}`} hover sx={i === 0 ? { '& td': { borderTop: '2px solid #9575cd' } } : undefined}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{i === 0 ? city : ''}</TableCell>
                  <TableCell>{tk}</TableCell>
                  {years.map((y) => (
                    <TableCell key={y} align="right">{fmtYen(v(FEES[city][tk], y))}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                    {fmtYen(years.reduce((s, y) => s + v(FEES[city][tk], y), 0))}
                  </TableCell>
                </TableRow>
              )),
              <TableRow key={`${city}-sum`} sx={{ bgcolor: '#f3e5f5' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>{city} 計</TableCell>
                {years.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(cityFeeTotal(city, y))}</TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtYen(years.reduce((s, y) => s + cityFeeTotal(city, y), 0))}
                </TableCell>
              </TableRow>,
            ];
          })}
          {/* 全社合計 */}
          <TableRow sx={{ bgcolor: '#fff8e1' }}>
            <TableCell colSpan={2} sx={{ fontWeight: 'bold' }}>全社 合計</TableCell>
            {years.map((y) => (
              <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{fmtYen(grandFeeTotal(y))}</TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtYen(years.reduce((s, y) => s + grandFeeTotal(y), 0))}
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
function UnitTable({ years }: { years: Year[] }) {
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
                const feeSum = years.reduce((s, y) => s + v(FEES[city][tk], y), 0);
                const cntSum = years.reduce((s, y) => s + v(COUNTS[city][tk], y), 0);
                return (
                  <TableRow key={`${city}-${tk}`} hover sx={i === 0 ? { '& td': { borderTop: '2px solid #9575cd' } } : undefined}>
                    <TableCell sx={{ fontWeight: 'bold' }}>{i === 0 ? city : ''}</TableCell>
                    <TableCell>{tk}</TableCell>
                    {years.map((y) => (
                      <TableCell key={y} align="right">
                        {fmtUnit(unitPrice(v(FEES[city][tk], y), v(COUNTS[city][tk], y)))}
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
                    {fmtUnit(unitPrice(cityFeeTotal(city, y), cityCountTotal(city, y)))}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
                  {fmtUnit(unitPrice(
                    years.reduce((s, y) => s + cityFeeTotal(city, y), 0),
                    years.reduce((s, y) => s + cityCountTotal(city, y), 0),
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
                {fmtUnit(unitPrice(grandFeeTotal(y), grandCountTotal(y)))}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 'bold', color: PURPLE }}>
              {fmtUnit(unitPrice(
                years.reduce((s, y) => s + grandFeeTotal(y), 0),
                years.reduce((s, y) => s + grandCountTotal(y), 0),
              ))}
            </TableCell>
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
  const [expandedPeriod, setExpandedPeriod] = useState<string>('p2');

  // 全期間（全年）の合計を出すためのヘルパ
  const allYears = useMemo(() => [...YEARS], []);

  const renderMetric = (years: Year[]) => {
    if (metric === 'count') return <CountTable years={years} />;
    if (metric === 'fee') return <FeeTable years={years} />;
    return <UnitTable years={years} />;
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
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f3e5f5' }}>
        <Typography variant="body2" sx={{ color: PURPLE }}>
          売買仲介の「件数」「仲介手数料」「単価（＝手数料÷件数）」を集計しています。
          市区ごとの計・全社合計・期合計はすべてこのページで自動計算しています。
          期ごと（前期：2020〜2022年／後期：2023〜2025年）に分けて表示します。
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
      {renderMetric(allYears)}

      {/* 期別 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mt: 3, mb: 1, color: PURPLE }}>
        期別
      </Typography>
      {PERIOD_DEFS.map((p) => (
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
            {renderMetric(p.years)}
          </AccordionDetails>
        </Accordion>
      ))}
    </Container>
  );
}
