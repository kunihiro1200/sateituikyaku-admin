import { useState, useEffect } from 'react';
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
  Chip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * 営業会議「他決分析」ページ
 *
 * 元データ（Googleスプレッドシート）を移植。
 * - 他決理由別（①〜㉔・不明）× 年（2024 / 2025 / 2026）: 専任 / 訪問後他決 / 未訪問他決
 *   勝率はこのページで計算する（勝率 = 専任 /（専任 + 訪問後他決））。
 * - 競合別: 専任 / 訪問後他決 / 未訪問他決（各年）+ 他決理由の内訳
 * - 各営業の特性: 担当者（K / U / Y / I / 林 / 麻）ごとの専任理由・他決理由
 *
 * ※ 人の名前は K・U・Y・I・林・麻 で集計しなおして表示する。
 */

const PURPLE = '#6a1b9a';
const HEADER_BG = '#ede7f6';
const SUBHEADER_BG = '#f3e5f5';
const RED = '#c62828';

// 勝率 = 専任 /（専任 + 訪問後他決）。分母0のときは null。
function winRate(sen: number, visitLoss: number): number | null {
  const den = sen + visitLoss;
  return den ? sen / den : null;
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return Math.round(v * 100) + '%';
}

// ===========================================================================
// 1) 他決理由別 × 年（専任 / 訪問後他決 / 未訪問他決）
// ===========================================================================
// [専任, 訪問後他決, 未訪問他決]（各年）。勝率は winRate() で計算する。
type YearTriple = { sen: number; visit: number; noVisit: number };
type ReasonRow = {
  reason: string;
  y2024: YearTriple;
  y2025: YearTriple;
  y2026: YearTriple;
};

const t = (sen: number, visit: number, noVisit: number): YearTriple => ({ sen, visit, noVisit });

const REASON_ROWS: ReasonRow[] = [
  { reason: '①知り合い',                 y2024: t(7, 7, 10),  y2025: t(9, 12, 13),  y2026: t(10, 15, 14) },
  { reason: '②価格が高い',               y2024: t(11, 17, 8), y2025: t(30, 6, 7),   y2026: t(38, 8, 9) },
  { reason: '③決定権者の把握',           y2024: t(1, 2, 6),   y2025: t(0, 1, 0),    y2026: t(0, 1, 0) },
  { reason: '④連絡不足',                 y2024: t(0, 5, 13),  y2025: t(1, 0, 1),    y2026: t(1, 0, 1) },
  { reason: '⑤購入物件の紹介',           y2024: t(3, 2, 4),   y2025: t(2, 0, 1),    y2026: t(4, 2, 1) },
  { reason: '⑥購入希望者がいる',         y2024: t(0, 6, 1),   y2025: t(7, 0, 2),    y2026: t(7, 2, 2) },
  { reason: '⑦以前つきあいがあった不動産', y2024: t(9, 1, 3),   y2025: t(2, 1, 1),    y2026: t(5, 1, 1) },
  { reason: '⑧ヒアリング不足',           y2024: t(0, 0, 12),  y2025: t(1, 5, 1),    y2026: t(1, 5, 1) },
  { reason: '⑨担当者の対応が良い',       y2024: t(29, 0, 1),  y2025: t(30, 4, 0),   y2026: t(40, 4, 0) },
  { reason: '⑩査定書郵送',               y2024: t(0, 1, 4),   y2025: t(1, 0, 1),    y2026: t(1, 0, 1) },
  { reason: '⑪１番電話のスピード',       y2024: t(2, 0, 2),   y2025: t(5, 0, 1),    y2026: t(6, 0, 1) },
  { reason: '⑫対応スピード（訪問１社目もこれに含む）', y2024: t(19, 0, 0), y2025: t(39, 1, 5), y2026: t(48, 2, 5) },
  { reason: '⑬買取保証',                 y2024: t(1, 1, 0),   y2025: t(0, 2, 0),    y2026: t(0, 2, 0) },
  { reason: '⑭買取額が高い',             y2024: t(0, 0, 1),   y2025: t(0, 4, 0),    y2026: t(0, 5, 0) },
  { reason: '⑮追客電話の対応',           y2024: t(7, 0, 0),   y2025: t(19, 1, 0),   y2026: t(25, 1, 0) },
  { reason: '⑯説明が丁寧',               y2024: t(46, 2, 0),  y2025: t(56, 2, 0),   y2026: t(75, 2, 0) },
  { reason: '⑰詳細な調査',               y2024: t(9, 1, 1),   y2025: t(9, 0, 1),    y2026: t(14, 0, 1) },
  { reason: '⑱不誠実、やるべきことをしない', y2024: t(3, 0, 0), y2025: t(0, 0, 0),   y2026: t(1, 0, 0) },
  { reason: '⑲定期的な追客電話',         y2024: t(17, 0, 2),  y2025: t(27, 1, 2),   y2026: t(34, 1, 2) },
  { reason: '⑳HPの口コミ',               y2024: t(2, 0, 0),   y2025: t(2, 0, 0),    y2026: t(2, 0, 0) },
  { reason: '㉑売買に強い（物件数、顧客が多い）', y2024: t(6, 1, 0), y2025: t(32, 3, 0), y2026: t(44, 3, 0) },
  { reason: '㉒仲介手数料のサービス',     y2024: t(1, 1, 0),   y2025: t(1, 0, 0),    y2026: t(1, 0, 0) },
  { reason: '㉓仲介手数料以外のサービス（特典）', y2024: t(1, 0, 0), y2025: t(0, 2, 0),  y2026: t(0, 2, 0) },
  { reason: '㉔妥当な査定額',             y2024: t(2, 1, 0),   y2025: t(8, 1, 0),    y2026: t(13, 2, 0) },
  { reason: '不明',                       y2024: t(2, 9, 11),  y2025: t(2, 11, 12),  y2026: t(2, 13, 13) },
];

// ===========================================================================
// 2) 競合別（専任 / 訪問後他決 / 未訪問他決）× 年
// ===========================================================================
// 元シートの競合別表より。勝率は winRate() で計算する。
type CompetitorRow = {
  name: string;
  y2024: YearTriple;
  y2025: YearTriple;
  y2026: YearTriple;
};

const COMPETITOR_ROWS: CompetitorRow[] = [
  { name: '別大興産',                        y2024: t(16, 2, 4),  y2025: t(31, 8, 4),  y2026: t(0, 0, 8) },
  { name: 'リライフ',                        y2024: t(2, 0, 1),   y2025: t(2, 1, 1),   y2026: t(0, 0, 1) },
  { name: 'センチュリー21（ハッピーハウス）', y2024: t(11, 4, 4),  y2025: t(10, 2, 2),  y2026: t(0, 0, 2) },
  { name: 'センチュリー２１（ベスト不動産）', y2024: t(15, 11, 3), y2025: t(34, 7, 7),  y2026: t(2, 0, 7) },
  { name: 'HouseDo(明野店）',                y2024: t(13, 4, 4),  y2025: t(10, 0, 2),  y2026: t(1, 0, 0) },
  { name: 'HouseDo下郡㈱ソーリン不動産',     y2024: t(0, 0, 1),   y2025: t(10, 1, 1),  y2026: t(0, 0, 1) },
  { name: 'HouseDo（敷戸）',                 y2024: t(7, 1, 0),   y2025: t(9, 1, 1),   y2026: t(0, 0, 1) },
  { name: 'HouseDo(大分南㈱MIC)',            y2024: t(4, 1, 0),   y2025: t(7, 3, 1),   y2026: t(0, 0, 3) },
  { name: '令和不動産',                      y2024: t(3, 4, 4),   y2025: t(0, 3, 1),   y2026: t(2, 0, 3) },
  { name: 'Yコーポレーション',               y2024: t(17, 8, 4),  y2025: t(35, 5, 12), y2026: t(1, 0, 5) },
  { name: '林興産',                          y2024: t(6, 1, 3),   y2025: t(8, 2, 0),   y2026: t(0, 0, 2) },
  { name: 'ベツダイ',                        y2024: t(2, 0, 2),   y2025: t(3, 0, 0),   y2026: t(0, 0, 0) },
  { name: 'オリエルホーム',                  y2024: t(1, 1, 0),   y2025: t(0, 0, 0),   y2026: t(0, 0, 0) },
  { name: '作州不動産',                      y2024: t(4, 0, 0),   y2025: t(5, 4, 0),   y2026: t(0, 0, 4) },
  { name: '久光大分',                        y2024: t(3, 1, 1),   y2025: t(2, 2, 0),   y2026: t(0, 0, 2) },
  { name: '玉井不動産',                      y2024: t(3, 0, 0),   y2025: t(2, 4, 0),   y2026: t(0, 0, 4) },
  { name: '大京穴吹不動産',                  y2024: t(2, 0, 1),   y2025: t(1, 5, 2),   y2026: t(0, 0, 5) },
  { name: '㈱AIC不動産',                     y2024: t(3, 0, 0),   y2025: t(6, 1, 0),   y2026: t(1, 0, 1) },
  { name: '榮建トータルハウジング',          y2024: t(1, 0, 0),   y2025: t(0, 0, 0),   y2026: t(0, 0, 0) },
  { name: 'サカイ㈱　大分リノベ',            y2024: t(1, 0, 0),   y2025: t(8, 5, 3),   y2026: t(0, 0, 5) },
  { name: '三越商事',                        y2024: t(2, 1, 0),   y2025: t(1, 0, 0),   y2026: t(0, 0, 0) },
  { name: '不明',                            y2024: t(25, 11, 23), y2025: t(40, 9, 20), y2026: t(6, 0, 9) },
];

// ===========================================================================
// 3) 各営業の特性（担当者ごとの専任理由 / 他決理由）
//    担当者: K / U / Y / I / 林 / 麻
// ===========================================================================
// 元シートは 2024年（Y/U/M/I）と 2025年（Y/U/M/I）の2ブロックに分かれていた。
// 依頼により K・U・Y・I・林・麻 の6名で集計しなおす。
//   - 麻・林・K は「新規」列（今後入力するため現時点は全て 0）。
//   - 既存データからは Y / U / I のみを 2024・2025 両ブロックで合算して残す。
//   - 旧「M」列のデータは新6名に含まれないため取り込まない。
type StaffCounts = { K: number; U: number; Y: number; I: number; hayashi: number; asa: number };
type StaffReasonRow = { reason: string; sen: StaffCounts; loss: StaffCounts };

// s(K, U, Y, I, 林, 麻)
const s = (K: number, U: number, Y: number, I: number, hayashi: number, asa: number): StaffCounts =>
  ({ K, U, Y, I, hayashi, asa });

// 元シートの担当者は 2024ブロック（Y/U/M/I）と 2025ブロック（Y/U/M/I）に分かれていた。
//
// 依頼により、麻・林・K は「新規」で今後入力していく列とする（＝現時点は 0）。
// そのため既存データからは Y / U / I のみを 2024・2025 両ブロックで合算して残し、
// 旧「M」列のデータは取り込まない（M は新6名に含まれないため）。
// K / 林 / 麻 は新規のため全理由 0 で開始し、今後この表に集計しなおして入力する。
//
// Y/U/I の値は 2024ブロック + 2025ブロック の合算（専任理由 / 他決理由それぞれ）。
const STAFF_ROWS: StaffReasonRow[] = [
  // reason,                                          専任: K  U   Y   I  林 麻,        他決: K U Y I 林 麻
  { reason: '①知り合い',                                 sen: s(0, 6, 1, 0, 0, 0),  loss: s(0, 5, 3, 0, 0, 0) },
  { reason: '②価格が高い',                               sen: s(0, 18, 1, 11, 0, 0), loss: s(0, 4, 7, 0, 0, 0) },
  { reason: '③決定権者の把握',                           sen: s(0, 0, 1, 0, 0, 0),  loss: s(0, 0, 1, 0, 0, 0) },
  { reason: '④連絡不足',                                 sen: s(0, 0, 1, 0, 0, 0),  loss: s(0, 0, 2, 0, 0, 0) },
  { reason: '⑤購入物件の紹介',                           sen: s(0, 2, 1, 0, 0, 0),  loss: s(0, 1, 1, 0, 0, 0) },
  { reason: '⑥購入希望者がいる',                         sen: s(0, 3, 2, 1, 0, 0),  loss: s(0, 0, 1, 0, 0, 0) },
  { reason: '⑦以前つきあいがあった不動産',               sen: s(0, 2, 5, 1, 0, 0),  loss: s(0, 1, 1, 0, 0, 0) },
  { reason: '⑧ヒアリング不足',                           sen: s(0, 1, 0, 0, 0, 0),  loss: s(0, 1, 2, 0, 0, 0) },
  { reason: '⑨担当者の対応が良い',                       sen: s(0, 28, 21, 1, 0, 0), loss: s(0, 1, 1, 0, 0, 0) },
  { reason: '⑩査定書郵送',                               sen: s(0, 1, 0, 0, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑪１番電話のスピード',                       sen: s(0, 3, 1, 0, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑫対応スピード（訪問１社目もこれに含む）',   sen: s(0, 28, 10, 6, 0, 0), loss: s(0, 1, 0, 0, 0, 0) },
  { reason: '⑬買取保証',                                 sen: s(0, 1, 0, 0, 0, 0),  loss: s(0, 1, 2, 0, 0, 0) },
  { reason: '⑭買取額が高い',                             sen: s(0, 0, 0, 0, 0, 0),  loss: s(0, 3, 1, 0, 0, 0) },
  { reason: '⑮追客電話の対応',                           sen: s(0, 11, 9, 1, 0, 0), loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑯説明が丁寧',                               sen: s(0, 29, 44, 9, 0, 0), loss: s(0, 2, 0, 0, 0, 0) },
  { reason: '⑰詳細な調査',                               sen: s(0, 5, 5, 2, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑱不誠実、やるべきことをしない',             sen: s(0, 1, 2, 0, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑲定期的な追客電話',                         sen: s(0, 3, 23, 7, 0, 0), loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '⑳HPの口コミ',                               sen: s(0, 0, 2, 2, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '㉑売買に強い（物件数、顧客が多い）',         sen: s(0, 2, 21, 12, 0, 0), loss: s(0, 2, 1, 1, 0, 0) },
  { reason: '㉒仲介手数料のサービス',                     sen: s(0, 0, 1, 0, 0, 0),  loss: s(0, 0, 0, 0, 0, 0) },
  { reason: '㉓仲介手数料以外のサービス（特典）',         sen: s(0, 0, 0, 0, 0, 0),  loss: s(0, 0, 1, 0, 0, 0) },
  { reason: '㉔妥当な査定額',                             sen: s(0, 3, 2, 3, 0, 0),  loss: s(0, 0, 1, 0, 0, 0) },
  { reason: '不明',                                       sen: s(0, 3, 0, 0, 0, 0),  loss: s(0, 3, 4, 3, 0, 0) },
];

function sumStaff(rows: StaffReasonRow[], pick: (r: StaffReasonRow) => StaffCounts): StaffCounts {
  return rows.reduce<StaffCounts>((acc, r) => {
    const c = pick(r);
    return {
      K: acc.K + c.K, U: acc.U + c.U, Y: acc.Y + c.Y,
      I: acc.I + c.I, hayashi: acc.hayashi + c.hayashi, asa: acc.asa + c.asa,
    };
  }, { K: 0, U: 0, Y: 0, I: 0, hayashi: 0, asa: 0 });
}

const STAFF_NAMES: { key: keyof StaffCounts; label: string }[] = [
  { key: 'K', label: 'K' },
  { key: 'U', label: 'U' },
  { key: 'Y', label: 'Y' },
  { key: 'I', label: 'I' },
  { key: 'hayashi', label: '林' },
  { key: 'asa', label: '麻' },
];

// 年ブロック（専任 / 訪問後他決 / 勝率 / 未訪問他決）のセルを描画するヘルパ
function YearCells({ v }: { v: YearTriple }) {
  return (
    <>
      <TableCell align="right">{v.sen}</TableCell>
      <TableCell align="right">{v.visit}</TableCell>
      <TableCell align="right" sx={{ color: PURPLE, fontWeight: 'bold' }}>{fmtPct(winRate(v.sen, v.visit))}</TableCell>
      <TableCell align="right">{v.noVisit}</TableCell>
    </>
  );
}

function sumTriples(rows: YearTriple[]): YearTriple {
  return rows.reduce<YearTriple>(
    (acc, r) => ({ sen: acc.sen + r.sen, visit: acc.visit + r.visit, noVisit: acc.noVisit + r.noVisit }),
    { sen: 0, visit: 0, noVisit: 0 },
  );
}

// 他決分析集計API（backend: /api/sales-meeting/loss-analysis-stats）の型
// 担当者名 -> 理由名 -> { sen, loss } それぞれ { 2024, 2025, 2026 } の件数
type YearCounts = { 2024: number; 2025: number; 2026: number };
type LossStats = Record<string, Record<string, { sen: YearCounts; loss: YearCounts }>>;

// 対象担当者（林 / 麻 / K）のキー対応（表の列キー）
const DYNAMIC_STAFF: { label: string; key: keyof StaffCounts }[] = [
  { label: '林', key: 'hayashi' },
  { label: '麻', key: 'asa' },
  { label: 'K', key: 'K' },
];

export default function SalesMeetingLossAnalysisPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string>('reasons');
  const [lossStats, setLossStats] = useState<LossStats | null>(null);
  const [lossLoaded, setLossLoaded] = useState(false);

  // 林 / 麻 / K の他決件数をDBから集計取得（元スプレッドシートのCOUNTIFS相当）
  useEffect(() => {
    let cancelled = false;
    api.get('/api/sales-meeting/loss-analysis-stats')
      .then((res) => {
        if (!cancelled) setLossStats(res.data?.data ?? {});
      })
      .catch(() => {
        if (!cancelled) setLossStats({}); // 失敗時は 0 扱いで表示継続
      })
      .finally(() => {
        if (!cancelled) setLossLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // API結果を STAFF_ROWS にマージする（専任理由・他決理由の 林/麻/K を上書き）。
  // 元シートの各営業の特性は「年合算の件数」なので、2024+2025+2026 を足す。
  const sumYc = (yc?: YearCounts) => (yc ? yc[2024] + yc[2025] + yc[2026] : 0);
  const staffRows: StaffReasonRow[] = STAFF_ROWS.map((r) => {
    if (!lossStats) return r;
    const sen = { ...r.sen };
    const loss = { ...r.loss };
    for (const { label, key } of DYNAMIC_STAFF) {
      const cell = lossStats[label]?.[r.reason];
      sen[key] = sumYc(cell?.sen);
      loss[key] = sumYc(cell?.loss);
    }
    return { ...r, sen, loss };
  });

  // 他決理由別の合計行
  const reasonTotal = {
    y2024: sumTriples(REASON_ROWS.map((r) => r.y2024)),
    y2025: sumTriples(REASON_ROWS.map((r) => r.y2025)),
    y2026: sumTriples(REASON_ROWS.map((r) => r.y2026)),
  };

  // 競合別の合計行
  const compTotal = {
    y2024: sumTriples(COMPETITOR_ROWS.map((r) => r.y2024)),
    y2025: sumTriples(COMPETITOR_ROWS.map((r) => r.y2025)),
    y2026: sumTriples(COMPETITOR_ROWS.map((r) => r.y2026)),
  };

  const staffSenTotal = sumStaff(staffRows, (r) => r.sen);
  const staffLossTotal = sumStaff(staffRows, (r) => r.loss);

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
          営業会議 他決分析
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: SUBHEADER_BG }}>
        <Typography variant="body2" sx={{ color: PURPLE }}>
          他決理由・競合・各営業の特性を集計しています。勝率＝専任 ÷（専任＋訪問後他決）で自動計算。
          各営業の特性は担当者（K / U / Y / I / 林 / 麻）ごとに集計しています。
          林・麻・K の専任・他決件数は売主データから自動集計しています（2024〜2026年合算）。
          専任＝状況「専任媒介／他決→専任」、他決＝状況「他決→追客／追客不要」を、営担・契約年月（他決判明時点）・競合名理由で集計。
        </Typography>
      </Paper>

      {/* ============ 1) 他決理由別 × 年 ============ */}
      <Accordion expanded={expanded === 'reasons'} onChange={() => setExpanded(expanded === 'reasons' ? '' : 'reasons')} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: HEADER_BG }}>
          <Typography fontWeight="bold" sx={{ color: PURPLE }}>他決理由別（2024 / 2025 / 2026）</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>他決理由</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2024年</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2025年</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2026年</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  {['専任', '訪問後他決', '勝率', '未訪問他決',
                    '専任', '訪問後他決', '勝率', '未訪問他決',
                    '専任', '訪問後他決', '勝率', '未訪問他決'].map((h, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {REASON_ROWS.map((r) => (
                  <TableRow key={r.reason} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{r.reason}</TableCell>
                    <YearCells v={r.y2024} />
                    <YearCells v={r.y2025} />
                    <YearCells v={r.y2026} />
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#fff8e1' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>計</TableCell>
                  <YearCells v={reasonTotal.y2024} />
                  <YearCells v={reasonTotal.y2025} />
                  <YearCells v={reasonTotal.y2026} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ============ 2) 競合別 × 年 ============ */}
      <Accordion expanded={expanded === 'competitors'} onChange={() => setExpanded(expanded === 'competitors' ? '' : 'competitors')} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: HEADER_BG }}>
          <Typography fontWeight="bold" sx={{ color: PURPLE }}>競合別（2024 / 2025 / 2026）</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>競合</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2024年</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2025年</TableCell>
                  <TableCell colSpan={4} align="center" sx={{ fontWeight: 'bold' }}>2026年</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  {['専任', '訪問後他決', '勝率', '未訪問他決',
                    '専任', '訪問後他決', '勝率', '未訪問他決',
                    '専任', '訪問後他決', '勝率', '未訪問他決'].map((h, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: 'bold' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {COMPETITOR_ROWS.map((r) => (
                  <TableRow key={r.name} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{r.name}</TableCell>
                    <YearCells v={r.y2024} />
                    <YearCells v={r.y2025} />
                    <YearCells v={r.y2026} />
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#fff8e1' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>計</TableCell>
                  <YearCells v={compTotal.y2024} />
                  <YearCells v={compTotal.y2025} />
                  <YearCells v={compTotal.y2026} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      {/* ============ 3) 各営業の特性 ============ */}
      <Accordion expanded={expanded === 'staff'} onChange={() => setExpanded(expanded === 'staff' ? '' : 'staff')} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: HEADER_BG }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontWeight="bold" sx={{ color: PURPLE }}>各営業の特性（K / U / Y / I / 林 / 麻）</Typography>
            {!lossLoaded && <Chip size="small" label="林・麻・Kの専任・他決を集計中…" />}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>理由</TableCell>
                  <TableCell colSpan={6} align="center" sx={{ fontWeight: 'bold' }}>専任理由</TableCell>
                  <TableCell colSpan={6} align="center" sx={{ fontWeight: 'bold', color: RED }}>他決理由</TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                  {STAFF_NAMES.map((n) => (
                    <TableCell key={`sen-${n.key}`} align="right" sx={{ fontWeight: 'bold' }}>{n.label}</TableCell>
                  ))}
                  {STAFF_NAMES.map((n) => (
                    <TableCell key={`loss-${n.key}`} align="right" sx={{ fontWeight: 'bold', color: RED }}>{n.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {staffRows.map((r) => (
                  <TableRow key={r.reason} hover>
                    <TableCell sx={{ fontWeight: 'bold' }}>{r.reason}</TableCell>
                    {STAFF_NAMES.map((n) => (
                      <TableCell key={`sen-${n.key}`} align="right">{r.sen[n.key]}</TableCell>
                    ))}
                    {STAFF_NAMES.map((n) => (
                      <TableCell key={`loss-${n.key}`} align="right" sx={{ color: RED }}>{r.loss[n.key]}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#fff8e1' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>計</TableCell>
                  {STAFF_NAMES.map((n) => (
                    <TableCell key={`sen-t-${n.key}`} align="right" sx={{ fontWeight: 'bold' }}>{staffSenTotal[n.key]}</TableCell>
                  ))}
                  {STAFF_NAMES.map((n) => (
                    <TableCell key={`loss-t-${n.key}`} align="right" sx={{ fontWeight: 'bold', color: RED }}>{staffLossTotal[n.key]}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </Container>
  );
}
