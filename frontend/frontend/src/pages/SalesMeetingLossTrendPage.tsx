import { useMemo, useState } from 'react';
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
          ・元データの不整合：種別（マ/戸/土）の計と「他決（訪問済み）」が一致しない期があります。追客電話の一部は元データが欠けています。ラベルが壊れていた行（#NAME?）は取り込んでいません。
        </Typography>
      </Paper>

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
              {/* サマリー（常に表示） */}
              {SUMMARY_ROWS.map((def) => renderDataRow(def, false))}

              {/* 詳細グループ（▶ / ◀ で開閉） */}
              {DETAIL_GROUPS.map((group) => {
                const open = !!openGroups[group.id];
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
