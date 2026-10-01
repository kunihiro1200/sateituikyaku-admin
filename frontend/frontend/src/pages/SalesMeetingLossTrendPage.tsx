import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  DETAIL_GROUPS,
  SUMMARY_ROWS,
  type TrendRow,
} from '../data/salesMeetingLossTrendData';
import {
  ACTIVE_MONTHS,
  FISCAL_MONTH_LABELS,
  PERIODS,
  PERIOD_LABEL,
  PERIOD_RANGE,
  RESOLVED_BY_PERIOD,
  fmtCell,
  fmtCount,
  fmtRatio,
  isEmptyRow,
  isPartialPeriod,
  rowAverage,
  rowTotal,
  rowYoY,
  type PeriodKey,
  type ResolvedRow,
} from '../utils/salesMeetingLossTrend';
import {
  fetchLossFiAaStats,
  type LossFiAaStats,
} from '../services/salesMeetingLossFiAa';
import {
  fetchLossStaffStats,
  type LossStaffStats,
  type StaffMetricKey,
} from '../services/salesMeetingLossStaff';

/**
 * 営業会議「他決数推移」ページ（会計年度＝10月〜翌9月ベース）
 *
 * - 1期＝10月〜翌9月。終了年でラベル（例：2026年度＝2025/10〜2026/9＝今期）。
 * - 月の並びは 10月始まり。
 * - 合計 / 平均 / 前年比 / 各種比率はすべてこのページで計算しなおしている。
 * - サマリーは常に表示。詳細は ▶ / ◀ をクリックすると開閉する（初期は非表示）。
 * - 期の頭（前年10〜12月）のデータが無い古い期は「参考（不完全）」として表示する。
 */

const PURPLE = '#6a1b9a';
const HEADER_BG = '#ede7f6';
const SUBHEADER_BG = '#f3e5f5';
const GROUP_BG = '#e1bee7';
const RED = '#c62828';
const GREEN = '#2e7d32';

/** 他決系の行は赤字で目立たせる */
const isLossRow = (key: string) => key.startsWith('他決');

const LABEL_WIDTH = 220;

/**
 * 担当別グループは静的データではなく DB集計API（loss-staff-stats）で描画する。
 * グループID → { metric, title, note } の対応表。
 * ここに載っているグループは API 値で動的に行を生成し、載っていないグループ（種別・確度など）は
 * 従来どおりデータファイルの静的値で描画する。
 */
type StaffGroupDef = {
  metric: StaffMetricKey;
  /** FI（福岡）売主限定の担当別 metric。全体行の後に「○○（福岡）」行として差し込む。 */
  fiMetric?: StaffMetricKey;
  title: string;
  loss?: boolean;
  note?: string;
};
const STAFF_GROUPS: Record<string, StaffGroupDef> = {
  'staff-visit': { metric: 'visitAssessment', fiMetric: 'visitAssessmentFi', title: '訪問査定数（担当別）' },
  'staff-sen': { metric: 'exclusive', fiMetric: 'exclusiveFi', title: '専任媒介数（担当別）' },
  'staff-loss': { metric: 'loss', fiMetric: 'lossFi', title: '他決数（担当別）', loss: true },
  'first-call': { metric: 'firstCall', fiMetric: 'firstCallFi', title: '一番電話（担当別）' },
  'followup-call': { metric: 'followupCall', fiMetric: 'followupCallFi', title: '追客電話（担当別）' },
  'visit-get-staff': { metric: 'visitGet', fiMetric: 'visitGetFi', title: '訪問査定取得数（担当別）' },
  assessment: { metric: 'assessment', fiMetric: 'assessmentFi', title: '査定額算出（担当別）' },
  ippan: { metric: 'general', fiMetric: 'generalFi', title: '一般媒介（担当別）' },
};

const STAFF_GROUP_NOTE =
  '売主DBから自動集計（担当は現行イニシャルに正規化。改名前の旧イニシャル名義は含みません）。';

/**
 * 担当別の率グループ（分子metric ÷ 分母metric を担当別に計算）。
 */
type StaffRateGroupDef = { num: StaffMetricKey; den: StaffMetricKey; title: string; note?: string };
const STAFF_RATE_GROUPS: Record<string, StaffRateGroupDef> = {
  'staff-sen-rate': {
    num: 'exclusive',
    den: 'visitAssessment',
    title: '専任取得率（担当別）',
    note: '専任媒介数 ÷ 訪問査定数（担当別・実績月の合計で計算）。',
  },
  'staff-loss-rate': {
    num: 'loss',
    den: 'visitAssessment',
    title: '他決率（担当別）',
    note: '他決数 ÷ 訪問査定数（担当別・実績月の合計で計算）。',
  },
};

/** 担当イニシャルの表示順（employees マスタの主要メンバー順。それ以外は後ろに五十音/英字順） */
const STAFF_ORDER = ['Y', 'U', 'I', 'K', 'R', '林', '麻', '久', '和', 'H', '生'];
function sortInitials(initials: string[]): string[] {
  return [...initials].sort((a, b) => {
    const ia = STAFF_ORDER.indexOf(a);
    const ib = STAFF_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'ja');
  });
}

function YoYCell({ v }: { v: number | null }) {
  if (v === null) return <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>;
  const up = v >= 1;
  return (
    <TableCell align="right" sx={{ color: up ? GREEN : RED, fontWeight: 'bold' }}>
      {(v * 100).toFixed(0)}%
    </TableCell>
  );
}

export default function SalesMeetingLossTrendPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('FY2026');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // FI/AA 別の他決件数（DBから集計。会計月スロット 0=10月 … 11=9月）
  const [fiAa, setFiAa] = useState<LossFiAaStats | null>(null);
  const [fiAaError, setFiAaError] = useState<string | null>(null);

  // 担当別の各指標（DBから集計。会計月スロット 0=10月 … 11=9月）
  const [staff, setStaff] = useState<LossStaffStats | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [followupAvailable, setFollowupAvailable] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetchLossFiAaStats()
      .then((data) => {
        if (!cancelled) setFiAa(data);
      })
      .catch((err) => {
        console.error('他決FI/AA集計の取得に失敗:', err);
        if (!cancelled) setFiAaError('FI/AA別の他決件数を取得できませんでした');
      });

    fetchLossStaffStats()
      .then((res) => {
        if (cancelled) return;
        setStaff(res.data);
        setFollowupAvailable(res.followupCallAvailable);
      })
      .catch((err) => {
        console.error('担当別集計の取得に失敗:', err);
        if (!cancelled) setStaffError('担当別の集計を取得できませんでした');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = RESOLVED_BY_PERIOD[period];
  const activeMonths = ACTIVE_MONTHS[period];
  const partial = isPartialPeriod(period);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const allOpen = DETAIL_GROUPS.every((g) => openGroups[g.id]);
  const setAll = (open: boolean) =>
    setOpenGroups(Object.fromEntries(DETAIL_GROUPS.map((g) => [g.id, open])));

  // 期次サマリー（サマリー行 × 各期の合計）
  const periodSummary = useMemo(
    () =>
      SUMMARY_ROWS.map((def) => ({
        key: def.key,
        label: def.label,
        cells: PERIODS.map((p) => {
          const r = RESOLVED_BY_PERIOD[p].get(def.key);
          if (!r || isEmptyRow(r)) return { period: p, row: null as ResolvedRow | null, total: null };
          return { period: p, row: r, total: rowTotal(r, p) };
        }),
      })),
    [],
  );

  const renderDataRow = (def: TrendRow, indent: boolean) => {
    const row = resolved.get(def.key);
    // その期にデータが無い行は表示しない（元シートのグレーセル相当）
    if (!row || isEmptyRow(row)) return null;

    const total = rowTotal(row, period);
    const average = rowAverage(row, period);
    const yoy = rowYoY(def.key, period);
    const loss = isLossRow(def.key);

    return (
      <TableRow key={def.key} hover>
        <TableCell
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            bgcolor: '#fff',
            borderRight: '1px solid #e0e0e0',
            pl: indent ? 3 : 1.5,
            fontWeight: indent ? 'normal' : 'bold',
            color: loss ? RED : 'inherit',
            minWidth: LABEL_WIDTH,
          }}
        >
          {row.note ? (
            <Tooltip title={row.note} placement="right">
              <span style={{ borderBottom: '1px dotted #999', cursor: 'help' }}>{row.label}</span>
            </Tooltip>
          ) : (
            row.label
          )}
        </TableCell>

        {FISCAL_MONTH_LABELS.map((_label, i) => {
          // 実績月より後（未到来）はグレー表示。合計には含めるが平均の母数には入れない
          const outOfRange = i >= activeMonths;
          return (
            <TableCell
              key={i}
              align="right"
              sx={{
                color: outOfRange ? 'text.disabled' : loss ? RED : 'inherit',
                bgcolor: outOfRange ? '#f5f5f5' : 'inherit',
              }}
            >
              {fmtCell(row, row.monthly[i])}
            </TableCell>
          );
        })}

        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fafafa' }}>
          {row.type === 'ratio' ? fmtRatio(total) : fmtCell(row, total)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: '#fafafa' }}>
          {row.type === 'count' ? fmtCount(average, 1) : fmtCell(row, average)}
        </TableCell>
        <YoYCell v={yoy} />
      </TableRow>
    );
  };

  /**
   * FI/AA 内訳のサブ行を描画する（件数のみ）。
   * monthly は会計月スロット（0=10月 … 11=9月）で、FISCAL_MONTH_LABELS と一致する。
   */
  const renderFiAaSubRow = (label: string, monthly: number[]) => {
    const total = monthly.reduce((a, b) => a + b, 0);
    const average = activeMonths > 0 ? total / activeMonths : null;
    return (
      <TableRow key={label} hover>
        <TableCell
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            bgcolor: '#fff',
            borderRight: '1px solid #e0e0e0',
            pl: 4.5,
            color: RED,
            fontSize: '0.82rem',
            minWidth: LABEL_WIDTH,
          }}
        >
          └ {label}
        </TableCell>
        {FISCAL_MONTH_LABELS.map((_label, i) => {
          const outOfRange = i >= activeMonths;
          return (
            <TableCell
              key={i}
              align="right"
              sx={{
                color: outOfRange ? 'text.disabled' : RED,
                bgcolor: outOfRange ? '#f5f5f5' : 'inherit',
                fontSize: '0.82rem',
              }}
            >
              {fmtCount(monthly[i])}
            </TableCell>
          );
        })}
        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fafafa', color: RED, fontSize: '0.82rem' }}>
          {fmtCount(total)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: '#fafafa', color: RED, fontSize: '0.82rem' }}>
          {fmtCount(average, 1)}
        </TableCell>
        <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
      </TableRow>
    );
  };

  /** 指定した他決行キーの直後に差し込む FI/AA サブ行群 */
  const renderFiAaSubRows = (rowKey: string) => {
    if (!fiAa) return [];
    const bucket = fiAa[period];
    if (!bucket) return [];

    const pick = (r: 'FI' | 'AA'): number[] => {
      if (rowKey === '他決（訪問済み）') return bucket[r].visited;
      if (rowKey === '他決（未訪問）') return bucket[r].unvisited;
      // 他決合計 = 訪問済み + 未訪問
      return bucket[r].visited.map((v, i) => v + bucket[r].unvisited[i]);
    };

    return [
      renderFiAaSubRow(`FI（福岡）`, pick('FI')),
      renderFiAaSubRow(`AA（大分）`, pick('AA')),
    ];
  };

  const FI_AA_TARGET_KEYS = new Set(['他決（訪問済み）', '他決（未訪問）', '他決合計']);

  // ---- 担当別グループ（DB集計API）の描画 ----

  /** 担当別の1行（会計月スロット配列をそのまま描画）。loss=true で赤字。 */
  const renderStaffRow = (
    key: string,
    label: string,
    monthly: number[],
    opts: { loss?: boolean; indent?: boolean; bold?: boolean } = {},
  ) => {
    const { loss = false, indent = true, bold = false } = opts;
    const total = monthly.reduce((a, b) => a + b, 0);
    const average = activeMonths > 0 ? total / activeMonths : null;
    const color = loss ? RED : 'inherit';
    return (
      <TableRow key={key} hover>
        <TableCell
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            bgcolor: '#fff',
            borderRight: '1px solid #e0e0e0',
            pl: indent ? 3 : 1.5,
            fontWeight: bold ? 'bold' : 'normal',
            color,
            minWidth: LABEL_WIDTH,
          }}
        >
          {label}
        </TableCell>
        {FISCAL_MONTH_LABELS.map((_label, i) => {
          const outOfRange = i >= activeMonths;
          return (
            <TableCell
              key={i}
              align="right"
              sx={{
                color: outOfRange ? 'text.disabled' : color,
                bgcolor: outOfRange ? '#f5f5f5' : 'inherit',
              }}
            >
              {fmtCount(monthly[i])}
            </TableCell>
          );
        })}
        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fafafa', color }}>
          {fmtCount(total)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: '#fafafa', color }}>
          {fmtCount(average, 1)}
        </TableCell>
        <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
      </TableRow>
    );
  };

  /** 担当別の比率行（分子monthly ÷ 分母monthly、実績月の合計で計算） */
  const renderStaffRatioRow = (
    key: string,
    label: string,
    numMonthly: number[],
    denMonthly: number[],
  ) => {
    const cells = FISCAL_MONTH_LABELS.map((_l, i) => {
      const d = denMonthly[i];
      const n = numMonthly[i];
      return d && d > 0 ? n / d : null;
    });
    const numSum = numMonthly.slice(0, activeMonths).reduce((a, b) => a + b, 0);
    const denSum = denMonthly.slice(0, activeMonths).reduce((a, b) => a + b, 0);
    const total = denSum > 0 ? numSum / denSum : null;
    return (
      <TableRow key={key} hover>
        <TableCell
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 1,
            bgcolor: '#fff',
            borderRight: '1px solid #e0e0e0',
            pl: 3,
            minWidth: LABEL_WIDTH,
          }}
        >
          {label}
        </TableCell>
        {cells.map((v, i) => {
          const outOfRange = i >= activeMonths;
          return (
            <TableCell
              key={i}
              align="right"
              sx={{ color: outOfRange ? 'text.disabled' : 'inherit', bgcolor: outOfRange ? '#f5f5f5' : 'inherit' }}
            >
              {v === null ? '—' : fmtRatio(v)}
            </TableCell>
          );
        })}
        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fafafa' }}>
          {total === null ? '—' : fmtRatio(total)}
        </TableCell>
        <TableCell align="right" sx={{ bgcolor: '#fafafa', color: 'text.disabled' }}>—</TableCell>
        <TableCell align="right" sx={{ color: 'text.disabled' }}>—</TableCell>
      </TableRow>
    );
  };

  /** 担当別グループの行群を API 値から生成する */
  const renderStaffGroupRows = (def: StaffGroupDef) => {
    if (!staff) return [] as JSX.Element[];
    const bucket = staff[period]?.[def.metric] ?? {};
    const initials = sortInitials(Object.keys(bucket).filter((ini) => {
      // 全期間0の担当は出さない（表示中の期で値があるものだけ）
      return (bucket[ini] ?? []).some((v) => v > 0);
    }));

    const rows: JSX.Element[] = [];
    const totalMonthly = Array(12).fill(0);
    for (const ini of initials) {
      const monthly = bucket[ini] ?? Array(12).fill(0);
      for (let i = 0; i < 12; i++) totalMonthly[i] += monthly[i];
      rows.push(renderStaffRow(`${def.metric}_${ini}`, ini, monthly, { loss: def.loss }));
    }
    if (initials.length > 0) {
      // 担当計
      rows.push(
        renderStaffRow(`${def.metric}_計`, '担当計', totalMonthly, { loss: def.loss, bold: true }),
      );
    }

    // FI（福岡）売主限定の担当別を追記する（担当計には含めない）
    if (def.fiMetric) {
      const fiBucket = staff[period]?.[def.fiMetric] ?? {};
      const fiInitials = sortInitials(
        Object.keys(fiBucket).filter((ini) => (fiBucket[ini] ?? []).some((v) => v > 0)),
      );
      const fiTotalMonthly = Array(12).fill(0);
      for (const ini of fiInitials) {
        const monthly = fiBucket[ini] ?? Array(12).fill(0);
        for (let i = 0; i < 12; i++) fiTotalMonthly[i] += monthly[i];
        rows.push(
          renderStaffRow(`${def.fiMetric}_${ini}`, `${ini}（福岡）`, monthly, { loss: def.loss }),
        );
      }
      if (fiInitials.length > 0) {
        rows.push(
          renderStaffRow(`${def.fiMetric}_計`, '福岡計', fiTotalMonthly, {
            loss: def.loss,
            bold: true,
          }),
        );
      }
    }

    return rows;
  };

  /** 担当別の率グループの行群を API 値から生成する */
  const renderStaffRateGroupRows = (def: StaffRateGroupDef) => {
    if (!staff) return [] as JSX.Element[];
    const numBucket = staff[period]?.[def.num] ?? {};
    const denBucket = staff[period]?.[def.den] ?? {};
    // 分子・分母どちらかに値がある担当を対象にする
    const initials = sortInitials(
      Array.from(new Set([...Object.keys(numBucket), ...Object.keys(denBucket)])).filter((ini) => {
        const n = numBucket[ini] ?? [];
        const d = denBucket[ini] ?? [];
        return n.some((v) => v > 0) || d.some((v) => v > 0);
      }),
    );
    if (initials.length === 0) return [] as JSX.Element[];
    return initials.map((ini) =>
      renderStaffRatioRow(
        `${def.num}_${def.den}_rate_${ini}`,
        ini,
        numBucket[ini] ?? Array(12).fill(0),
        denBucket[ini] ?? Array(12).fill(0),
      ),
    );
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
          営業会議 他決数推移
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 2, bgcolor: SUBHEADER_BG }}>
        <Typography variant="body2" sx={{ color: PURPLE }}>
          期は <b>10月〜翌9月</b>（終了年で表記）。<b>2026年度＝2025/10〜2026/9＝今期</b>です。
          月の並びは10月始まり。元シートの 合計 / 平均 / 前年比 / 各種比率は取り込まず、すべてこのページで期ベースに集計しなおしています。
        </Typography>
        <Typography variant="caption" component="div" sx={{ mt: 1, color: PURPLE }}>
          ・合計：12ヶ月の合計（比率行は「分子の合計 ÷ 分母の合計」）／平均：合計 ÷ 実績月数（比率行は実績月の月次比率の平均）／前年比：当期合計 ÷ 前期合計<br />
          ・実績月＝依頼件数が入っている月（{PERIOD_LABEL[period]}は{activeMonths}ヶ月）。未到来の月はグレー表示で、平均の母数から外しています（合計には含めます）。<br />
          ・訪問査定取得数比＝訪問査定取得数÷依頼件数／他決（訪問済み）比＝÷訪問査定取得数／他決（未訪問）比＝÷（依頼件数−訪問査定取得数）／専任・一般取得比＝÷訪問査定取得数<br />
          ・担当別の専任取得率・他決率＝それぞれ÷訪問査定数（担当別）。<br />
          ・「参考」表示の期は、期の頭（前年10〜12月）の元データが揃っていない不完全な期です。<br />
          ・元データの不整合：種別（マ/戸/土）の計と「他決（訪問済み）」が一致しない期があります。追客電話の一部は元データが欠けています。ラベルが壊れていた行（#NAME?）は取り込んでいません。<br />
          ・<b>FI（福岡）/ AA（大分）内訳</b>は売主DBから集計（状況＝「他決→追客」「他決→追客不要」、「契約年月 他決は分かった時点」で期に割当、営担ありを訪問済み）。売主番号が「FI」で始まるものをFI、それ以外をAAとしています。元データの合計行とは集計基準が異なるため一致しないことがあります。
        </Typography>
      </Paper>
      {fiAaError && (
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#fff3e0' }}>
          <Typography variant="body2" sx={{ color: '#e65100' }}>
            {fiAaError}
          </Typography>
        </Paper>
      )}

      {/* ============ 期次サマリー（各期の合計） ============ */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ px: 2, py: 1, bgcolor: HEADER_BG }}>
          <Typography fontWeight="bold" sx={{ color: PURPLE }}>期次サマリー（期合計・10月〜翌9月）</Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                <TableCell sx={{ fontWeight: 'bold', minWidth: LABEL_WIDTH }}>項目</TableCell>
                {PERIODS.map((p) => (
                  <TableCell key={p} align="right" sx={{ fontWeight: 'bold' }}>
                    {PERIOD_LABEL[p]}
                    {isPartialPeriod(p) && (
                      <Typography component="span" variant="caption" sx={{ color: '#8d6e63', ml: 0.5 }}>（参考）</Typography>
                    )}
                    <Typography component="div" variant="caption" sx={{ color: 'text.secondary', fontWeight: 'normal' }}>
                      {PERIOD_RANGE[p]}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {periodSummary.map((r) => (
                <TableRow key={r.key} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: isLossRow(r.key) ? RED : 'inherit' }}>
                    {r.label}
                  </TableCell>
                  {r.cells.map((c) => (
                    <TableCell
                      key={c.period}
                      align="right"
                      sx={{
                        color: isLossRow(r.key) ? RED : 'inherit',
                        fontWeight: c.period === period ? 'bold' : 'normal',
                        bgcolor: c.period === period ? '#f3e5f5' : 'inherit',
                      }}
                    >
                      {c.row ? fmtCell(c.row, c.total) : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ============ 期タブ ============ */}
      <Paper sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Tabs
            value={period}
            onChange={(_e, v: PeriodKey) => setPeriod(v)}
            textColor="inherit"
            sx={{ '& .MuiTab-root': { fontWeight: 'bold', color: PURPLE }, '& .MuiTabs-indicator': { backgroundColor: PURPLE } }}
          >
            {PERIODS.map((p) => (
              <Tab key={p} value={p} label={PERIOD_LABEL[p]} />
            ))}
          </Tabs>
          <Button size="small" onClick={() => setAll(!allOpen)} sx={{ color: PURPLE, mr: 1 }}>
            {allOpen ? '詳細をすべて閉じる ◀' : '詳細をすべて開く ▶'}
          </Button>
        </Box>
      </Paper>

      {/* 期の説明バー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
        <Typography variant="body2" sx={{ color: PURPLE, fontWeight: 'bold' }}>
          {PERIOD_LABEL[period]}（{PERIOD_RANGE[period]}）
        </Typography>
        {partial && (
          <Chip
            size="small"
            label="参考：期の一部データが欠けています"
            sx={{ bgcolor: '#efebe9', color: '#5d4037' }}
          />
        )}
      </Box>

      {/* ============ 月別テーブル ============ */}
      <Paper>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table size="small" stickyHeader sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    bgcolor: SUBHEADER_BG,
                    fontWeight: 'bold',
                    minWidth: LABEL_WIDTH,
                    borderRight: '1px solid #e0e0e0',
                  }}
                >
                  {PERIOD_LABEL[period]}
                </TableCell>
                {FISCAL_MONTH_LABELS.map((label) => (
                  <TableCell key={label} align="right" sx={{ bgcolor: SUBHEADER_BG, fontWeight: 'bold' }}>
                    {label}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ bgcolor: SUBHEADER_BG, fontWeight: 'bold' }}>合計</TableCell>
                <TableCell align="right" sx={{ bgcolor: SUBHEADER_BG, fontWeight: 'bold' }}>平均</TableCell>
                <TableCell align="right" sx={{ bgcolor: SUBHEADER_BG, fontWeight: 'bold' }}>前年比</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* サマリー（常に表示）。他決系の行の直後に FI/AA 内訳を差し込む */}
              {SUMMARY_ROWS.map((def) => {
                const main = renderDataRow(def, false);
                if (!main) return null;
                if (!FI_AA_TARGET_KEYS.has(def.key)) return main;
                return [main, ...renderFiAaSubRows(def.key)];
              })}

              {/* 詳細グループ（▶ / ◀ で開閉） */}
              {DETAIL_GROUPS.map((group) => {
                const open = !!openGroups[group.id];

                const staffDef = STAFF_GROUPS[group.id];
                const rateDef = STAFF_RATE_GROUPS[group.id];

                // 担当別グループ（件数）/ 率グループは DB集計API 値で描画する
                if (staffDef || rateDef) {
                  const bodyRows = staffDef
                    ? renderStaffGroupRows(staffDef)
                    : renderStaffRateGroupRows(rateDef!);
                  // 追客電話がシート未取得のときはその旨
                  const followupMissing =
                    staffDef?.metric === 'followupCall' && !followupAvailable;
                  if (bodyRows.length === 0 && !followupMissing) {
                    // データ未取得（ロード中）でも見出しは出す。行は空。
                  }
                  const title = (staffDef ?? rateDef)!.title;
                  const groupNote = staffDef
                    ? STAFF_GROUP_NOTE +
                      (staffDef.metric === 'followupCall'
                        ? '（追客電話は「売主追客ログ」から集計）'
                        : '') +
                      (staffDef.fiMetric
                        ? '「○○（福岡）」はFI売主（売主番号がFIで始まる物件）限定の担当別。担当計には含めません。'
                        : '')
                    : rateDef!.note ?? '';
                  const rowCountLabel = followupMissing
                    ? '追客ログを取得できませんでした'
                    : `${bodyRows.length}行`;

                  return [
                    <TableRow
                      key={group.id}
                      hover
                      onClick={() => toggleGroup(group.id)}
                      sx={{ cursor: 'pointer', bgcolor: GROUP_BG }}
                    >
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          bgcolor: GROUP_BG,
                          fontWeight: 'bold',
                          color: PURPLE,
                          borderRight: '1px solid #ce93d8',
                          minWidth: LABEL_WIDTH,
                        }}
                      >
                        <Box component="span" sx={{ mr: 0.75, fontSize: '0.9rem' }}>
                          {open ? '◀' : '▶'}
                        </Box>
                        {title}
                      </TableCell>
                      <TableCell colSpan={FISCAL_MONTH_LABELS.length + 3} sx={{ bgcolor: GROUP_BG }}>
                        <Typography variant="caption" sx={{ color: PURPLE }}>
                          {open
                            ? groupNote || 'クリックで非表示'
                            : `クリックで表示（${rowCountLabel}）${groupNote ? ' / ' + groupNote : ''}`}
                        </Typography>
                      </TableCell>
                    </TableRow>,
                    ...(open ? bodyRows : []),
                  ];
                }

                // 通常グループ（種別・確度など）は従来どおり静的データで描画
                const visibleRows = group.rows.filter((def) => {
                  const r = resolved.get(def.key);
                  return r && !isEmptyRow(r);
                });
                if (visibleRows.length === 0) return null;

                return [
                  <TableRow
                    key={group.id}
                    hover
                    onClick={() => toggleGroup(group.id)}
                    sx={{ cursor: 'pointer', bgcolor: GROUP_BG }}
                  >
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        bgcolor: GROUP_BG,
                        fontWeight: 'bold',
                        color: PURPLE,
                        borderRight: '1px solid #ce93d8',
                        minWidth: LABEL_WIDTH,
                      }}
                    >
                      <Box component="span" sx={{ mr: 0.75, fontSize: '0.9rem' }}>
                        {open ? '◀' : '▶'}
                      </Box>
                      {group.title}
                    </TableCell>
                    <TableCell colSpan={FISCAL_MONTH_LABELS.length + 3} sx={{ bgcolor: GROUP_BG }}>
                      <Typography variant="caption" sx={{ color: PURPLE }}>
                        {open
                          ? group.note ?? 'クリックで非表示'
                          : `クリックで表示（${visibleRows.length}行）${group.note ? ' / ' + group.note : ''}`}
                      </Typography>
                    </TableCell>
                  </TableRow>,
                  ...(open ? visibleRows.map((def) => renderDataRow(def, true)) : []),
                ];
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
