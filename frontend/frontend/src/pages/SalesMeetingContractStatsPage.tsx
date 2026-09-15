import { useMemo } from 'react';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * 営業会議「契約集計」ページ
 *
 * 目的：専任は両手を増やす。一般は他決を防ぐ。
 *
 * 元データ（Googleスプレッドシート）を移植し、率はこのページで再計算する。
 * 率の定義（元シートから逆算して確定）:
 *   専任両手率 = 専任両手 / (専任両手 + 専任片手)
 *   一般両手率 = 一般両手 / (一般両手 + 一般片手 + 一般他決)
 *   一般片手率 = 一般片手 / (一般両手 + 一般片手 + 一般他決)
 *   他決率     = 一般他決 / (一般両手 + 一般片手 + 一般他決)
 */

// 月次の生データ（率は含めない。率は計算で求める）
// [自動更新, 専任両手, 専任片手, 一般両手, 一般片手, 一般他決,
//  他社片手, 他社両手, 自社買取LB, 自社買取転売, 買取紹介片手, 買取紹介両手,
//  専任解除, 一般解除]
type Counts = {
  ym: string;
  auto: number;      // 自動更新
  senRyo: number;    // 専任両手
  senKata: number;   // 専任片手
  ipRyo: number;     // 一般両手
  ipKata: number;    // 一般片手
  ipTa: number;      // 一般他決
  otherKata: number; // 他社物件片手
  otherRyo: number;  // 他社物件両手
  buyLB: number;     // 自社買取（リースバック）
  buyResale: number; // 自社買取（転売）
  refKata: number;   // 買取紹介（片手）
  refRyo: number;    // 買取紹介（両手）
  senKaijo: number;  // 専任解除
  ipKaijo: number;   // 一般媒介解除
};

const c = (
  ym: string,
  auto: number, senRyo: number, senKata: number,
  ipRyo: number, ipKata: number, ipTa: number,
  otherKata: number, otherRyo: number,
  buyLB: number, buyResale: number,
  refKata: number, refRyo: number,
  senKaijo: number, ipKaijo: number,
): Counts => ({
  ym, auto, senRyo, senKata, ipRyo, ipKata, ipTa,
  otherKata, otherRyo, buyLB, buyResale, refKata, refRyo, senKaijo, ipKaijo,
});

// すべての月次データ（2024/1以降は専任解除・一般解除の列あり。それ以前は0扱い）
const MONTHLY: Counts[] = [
  //   ym       自動 専両 専片 般両 般片 般他 他片 他両 LB 転売 紹片 紹両 専解 般解
  c('2019/1',   1, 2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/2',   1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/3',   1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0),
  c('2019/4',   0, 1, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/5',   2, 1, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/6',   0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/7',   1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/8',   1, 1, 1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/9',   3, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/10',  3, 2, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/11',  2, 1, 1, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2019/12',  2, 2, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),

  c('2020/1',   5, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/2',   1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/3',   2, 0, 3, 0, 3, 0, 0, 0, 1, 0, 0, 0, 0, 0),
  c('2020/4',   2, 0, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/5',   2, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0),
  c('2020/6',   3, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0),
  c('2020/7',   5, 2, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/8',   1, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0),
  c('2020/9',   4, 1, 0, 1, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/10',  3, 1, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/11',  4, 1, 1, 0, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2020/12',  2, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),

  c('2021/1',   5, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0),
  c('2021/2',   3, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/3',  10, 1, 2, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/4',   5, 2, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/5',   8, 2, 1, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/6',   1, 2, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/7',   2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/8',   4, 1, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/9',   6, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/10',  0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0),
  c('2021/11',  1, 2, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2021/12',  5, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),

  c('2022/1',   1, 2, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2022/2',   3, 4, 1, 0, 3, 0, 0, 0, 0, 0, 1, 0, 0, 0),
  c('2022/3',   5, 3, 0, 0, 6, 0, 0, 0, 0, 0, 1, 1, 0, 0),
  c('2022/4',   2, 3, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2022/5',   6, 1, 0, 0, 3, 0, 0, 0, 0, 0, 3, 1, 0, 0),
  c('2022/6',   3, 2, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0),
  c('2022/7',   1, 3, 0, 0, 3, 0, 0, 0, 0, 0, 0, 3, 0, 0),
  c('2022/8',   3, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2022/9',   8, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0),
  c('2022/10',  0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2022/11',  3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0),
  c('2022/12',  2, 5, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0),

  c('2023/1',   3, 2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2023/2',   2, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2023/3',   6, 2, 1, 1, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0),
  c('2023/4',   8, 3, 2, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0),
  c('2023/5',   4, 1, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2023/6',   3, 3, 0, 2, 3, 0, 0, 0, 0, 0, 0, 2, 0, 0),
  c('2023/7',   7, 3, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0),
  c('2023/8',   6, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2023/9',   3, 0, 1, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2023/10',  2, 4, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2023/11',  4, 1, 0, 0, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2023/12',  5, 2, 0, 0, 3, 0, 0, 0, 1, 1, 0, 0, 0, 0),

  c('2024/1',   3, 8, 0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 0, 0),
  c('2024/2',   5, 4, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2024/3',   1, 3, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2024/4',   5, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0),
  c('2024/5',   3, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2024/6',   2, 3, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2024/7',   6, 2, 1, 0, 2, 0, 0, 0, 0, 0, 0, 1, 1, 0),
  c('2024/8',   2, 3, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2024/9',   5, 2, 1, 0, 4, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2024/10',  5, 2, 0, 0, 1, 0, 0, 1, 0, 0, 0, 3, 1, 0),
  c('2024/11',  5, 1, 2, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2024/12',  4, 2, 0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0),

  c('2025/1',   1, 2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2025/2',   2, 4, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 1),
  c('2025/3',   2, 8, 1, 0, 9, 0, 0, 0, 0, 0, 0, 1, 2, 0),
  c('2025/4',   2, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0),
  c('2025/5',   3, 4, 0, 1, 4, 0, 0, 0, 0, 0, 0, 1, 0, 0),
  c('2025/6',   5, 0, 1, 0, 3, 0, 0, 0, 0, 1, 0, 1, 2, 0),
  c('2025/7',   2, 3, 0, 0, 5, 1, 0, 0, 0, 0, 0, 2, 0, 0),
  c('2025/8',   4, 2, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2025/9',   3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2025/10',  2, 3, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2025/11',  1, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0),
  c('2025/12',  4, 3, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0),

  c('2026/1',   4, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/2',   3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/3',   6, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/4',   2, 0, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/5',   5, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0),
  c('2026/6',   3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/7',   7, 5, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/8',   3, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  c('2026/9',   4, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
];

// 「計（他決除く）」= 契約系（他決を除く）成約の合計
// 元シートの定義に合わせ、以下を合算（他決は除外）:
//   専任両手 + 専任片手 + 一般両手 + 一般片手
//   + 他社片手 + 他社両手 + 自社買取LB + 自社買取転売
//   + 買取紹介片手 + 買取紹介両手
function totalExclOther(r: Counts): number {
  return (
    r.senRyo + r.senKata + r.ipRyo + r.ipKata +
    r.otherKata + r.otherRyo + r.buyLB + r.buyResale +
    r.refKata + r.refRyo
  );
}

// 率の計算（分母0のときは null を返す）
function calcRates(r: {
  senRyo: number; senKata: number; ipRyo: number; ipKata: number; ipTa: number;
}) {
  const senDen = r.senRyo + r.senKata;
  const ipDen = r.ipRyo + r.ipKata + r.ipTa;
  return {
    senRyoRate: senDen ? r.senRyo / senDen : null,
    ipRyoRate: ipDen ? r.ipRyo / ipDen : null,
    ipKataRate: ipDen ? r.ipKata / ipDen : null,
    taRate: ipDen ? r.ipTa / ipDen : null,
  };
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return (v * 100).toFixed(2) + '%';
}

function sumCounts(rows: Counts[]): Counts {
  return rows.reduce<Counts>((acc, r) => ({
    ym: acc.ym,
    auto: acc.auto + r.auto,
    senRyo: acc.senRyo + r.senRyo,
    senKata: acc.senKata + r.senKata,
    ipRyo: acc.ipRyo + r.ipRyo,
    ipKata: acc.ipKata + r.ipKata,
    ipTa: acc.ipTa + r.ipTa,
    otherKata: acc.otherKata + r.otherKata,
    otherRyo: acc.otherRyo + r.otherRyo,
    buyLB: acc.buyLB + r.buyLB,
    buyResale: acc.buyResale + r.buyResale,
    refKata: acc.refKata + r.refKata,
    refRyo: acc.refRyo + r.refRyo,
    senKaijo: acc.senKaijo + r.senKaijo,
    ipKaijo: acc.ipKaijo + r.ipKaijo,
  }), {
    ym: '', auto: 0, senRyo: 0, senKata: 0, ipRyo: 0, ipKata: 0, ipTa: 0,
    otherKata: 0, otherRyo: 0, buyLB: 0, buyResale: 0, refKata: 0, refRyo: 0,
    senKaijo: 0, ipKaijo: 0,
  });
}

// 期（決算期）でスライスする: from/to は 'YYYY/M'
function ymNum(ym: string): number {
  const [y, m] = ym.split('/').map(Number);
  return y * 12 + (m - 1);
}
function sliceByPeriod(from: string, to: string): Counts[] {
  const f = ymNum(from);
  const t = ymNum(to);
  return MONTHLY.filter((r) => {
    const n = ymNum(r.ym);
    return n >= f && n <= t;
  });
}

const COLUMNS = [
  '自動更新', '専任両手', '専任片手', '一般両手', '一般片手', '一般他決',
  '他社物件片手', '他社物件両手', '自社買取（リースバック）', '自社買取（転売）',
  '買取紹介（片手）', '買取紹介（両手）', '専任解除', '一般媒介解除', '計（他決除く）',
];

const RATE_COLUMNS = ['専任・両手率', '一般・両手率', '一般・片手率', '他決率'];

function countCells(r: Counts): (number)[] {
  return [
    r.auto, r.senRyo, r.senKata, r.ipRyo, r.ipKata, r.ipTa,
    r.otherKata, r.otherRyo, r.buyLB, r.buyResale, r.refKata, r.refRyo,
    r.senKaijo, r.ipKaijo, totalExclOther(r),
  ];
}

export default function SalesMeetingContractStatsPage() {
  const navigate = useNavigate();

  const periods = useMemo(() => ([
    { label: '2024年10月〜2025年9月（期）', rows: sliceByPeriod('2024/10', '2025/9') },
    { label: '2025年10月〜2026年9月（期）', rows: sliceByPeriod('2025/10', '2026/9') },
  ]), []);

  return (
    <Container maxWidth={false} sx={{ py: 3, px: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/shared-items')}
          size="small"
          sx={{ color: '#6a1b9a' }}
        >
          共有一覧へ戻る
        </Button>
        <Typography variant="h5" fontWeight="bold" sx={{ color: '#6a1b9a' }}>
          営業会議 契約集計
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f3e5f5' }}>
        <Typography variant="body1" fontWeight="bold" sx={{ color: '#6a1b9a' }}>
          ＜目的：専任は両手を増やす。一般は他決を防ぐ＞
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: '#6a1b9a' }}>
          専任両手率・一般両手率・一般片手率・他決率はこのページで自動計算しています。
        </Typography>
      </Paper>

      {/* 期別集計 */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: '#6a1b9a' }}>
        期別集計
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#ede7f6' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>期</TableCell>
              {COLUMNS.map((col) => (
                <TableCell key={col} align="right" sx={{ fontWeight: 'bold' }}>{col}</TableCell>
              ))}
              {RATE_COLUMNS.map((col) => (
                <TableCell key={col} align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {periods.map(({ label, rows }) => {
              const total = sumCounts(rows);
              const rates = calcRates(total);
              return (
                <TableRow key={label} sx={{ bgcolor: '#fff8e1' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{label}</TableCell>
                  {countCells(total).map((v, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: 'bold' }}>{v}</TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmtPct(rates.senRyoRate)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmtPct(rates.ipRyoRate)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{fmtPct(rates.ipKataRate)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: '#c62828' }}>{fmtPct(rates.taRate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 月次データ（全期間） */}
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: '#6a1b9a' }}>
        月次データ
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small" stickyHeader sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', bgcolor: '#ede7f6' }}>年月</TableCell>
              {COLUMNS.map((col) => (
                <TableCell key={col} align="right" sx={{ fontWeight: 'bold', bgcolor: '#ede7f6' }}>{col}</TableCell>
              ))}
              {RATE_COLUMNS.map((col) => (
                <TableCell key={col} align="right" sx={{ fontWeight: 'bold', bgcolor: '#ede7f6', color: '#c62828' }}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {MONTHLY.map((r) => {
              const rates = calcRates(r);
              return (
                <TableRow key={r.ym} hover>
                  <TableCell>{r.ym}</TableCell>
                  {countCells(r).map((v, i) => (
                    <TableCell key={i} align="right">{v}</TableCell>
                  ))}
                  <TableCell align="right">{fmtPct(rates.senRyoRate)}</TableCell>
                  <TableCell align="right">{fmtPct(rates.ipRyoRate)}</TableCell>
                  <TableCell align="right">{fmtPct(rates.ipKataRate)}</TableCell>
                  <TableCell align="right" sx={{ color: '#c62828' }}>{fmtPct(rates.taRate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
