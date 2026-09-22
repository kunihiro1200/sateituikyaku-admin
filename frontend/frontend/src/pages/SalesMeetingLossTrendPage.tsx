import { useMemo, useState } from 'react';
import {
  Box,
  Button,
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
  MONTH_LABELS,
  SUMMARY_ROWS,
  YEARS,
  type TrendRow,
  type YearKey,
} from '../data/salesMeetingLossTrendData';
import {
  ACTIVE_MONTHS,
  RESOLVED_BY_YEAR,
  fmtCell,
  fmtCount,
  fmtRatio,
  isEmptyRow,
  rowAverage,
  rowTotal,
  rowYoY,
  type ResolvedRow,
} from '../utils/salesMeetingLossTrend';

/**
 * 営業会議「他決数推移」ページ
 *
 * 元シート（Googleスプレッドシート「他決数推移」）を移植。
 * - 合計 / 平均 / 前年比 / 各種比率はすべてこのページで計算しなおしている。
 * - サマリーは常に表示。詳細は ▶ / ◀ をクリックすると開閉する（初期状態は非表示）。
 * - 元シートのグレーの作業用セル（「非表示」マーカー列）は表示していない。
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
  const [year, setYear] = useState<YearKey>('2026');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const resolved = RESOLVED_BY_YEAR[year];
  const activeMonths = ACTIVE_MONTHS[year];

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const allOpen = DETAIL_GROUPS.every((g) => openGroups[g.id]);
  const setAll = (open: boolean) =>
    setOpenGroups(Object.fromEntries(DETAIL_GROUPS.map((g) => [g.id, open])));

  // 年次サマリー（サマリー行 × 各年の合計）
  const yearlySummary = useMemo(
    () =>
      SUMMARY_ROWS.map((def) => ({
        key: def.key,
        label: def.label,
        cells: YEARS.map((y) => {
          const r = RESOLVED_BY_YEAR[y].get(def.key);
          if (!r || isEmptyRow(r)) return { year: y, row: null as ResolvedRow | null, total: null };
          return { year: y, row: r, total: rowTotal(r, y) };
        }),
      })),
    [],
  );

  const renderDataRow = (def: TrendRow, indent: boolean) => {
    const row = resolved.get(def.key);
    // その年にデータが無い行は表示しない（元シートのグレーセル相当）
    if (!row || isEmptyRow(row)) return null;

    const total = rowTotal(row, year);
    const average = rowAverage(row, year);
    const yoy = rowYoY(def.key, year);
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

        {MONTH_LABELS.map((_label, i) => {
          // 実績月より後の月（未到来）はグレー表示。合計には含めるが平均の母数には入れない
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
          元シートの 合計 / 平均 / 前年比 / 各種比率は取り込まず、すべてこのページで集計しなおしています
          （元シートは #DIV/0! や 320%、マイナス％などの計算崩れが混在していました）。
        </Typography>
        <Typography variant="caption" component="div" sx={{ mt: 1, color: PURPLE }}>
          ・合計：12ヶ月の合計（比率行は「分子の合計 ÷ 分母の合計」）／平均：合計 ÷ 実績月数（比率行は実績月の月次比率の平均）／前年比：当年合計 ÷ 前年合計<br />
          ・実績月＝依頼件数が入っている月（{year}年は{activeMonths}ヶ月）。未到来の月はグレー表示で、平均の母数から外しています（合計には含めます）。<br />
          ・訪問査定取得数比＝訪問査定取得数÷依頼件数／他決（訪問済み）比＝÷訪問査定取得数／他決（未訪問）比＝÷（依頼件数−訪問査定取得数）／専任・一般取得比＝÷訪問査定取得数<br />
          ・担当別の専任取得率・他決率＝それぞれ÷訪問査定数（担当別）。<br />
          ・元データの不整合：種別（マ/戸/土）の計と「他決（訪問済み）」が一致しない年があります。追客電話の2023年は1〜4月のみ。ラベルが壊れていた行（#NAME?）は取り込んでいません。
        </Typography>
      </Paper>

      {/* ============ 年次サマリー（各年の合計） ============ */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ px: 2, py: 1, bgcolor: HEADER_BG }}>
          <Typography fontWeight="bold" sx={{ color: PURPLE }}>年次サマリー（年合計）</Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: SUBHEADER_BG }}>
                <TableCell sx={{ fontWeight: 'bold', minWidth: LABEL_WIDTH }}>項目</TableCell>
                {YEARS.map((y) => (
                  <TableCell key={y} align="right" sx={{ fontWeight: 'bold' }}>{y}年</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {yearlySummary.map((r) => (
                <TableRow key={r.key} hover>
                  <TableCell sx={{ fontWeight: 'bold', color: isLossRow(r.key) ? RED : 'inherit' }}>
                    {r.label}
                  </TableCell>
                  {r.cells.map((c) => (
                    <TableCell
                      key={c.year}
                      align="right"
                      sx={{
                        color: isLossRow(r.key) ? RED : 'inherit',
                        fontWeight: c.year === year ? 'bold' : 'normal',
                        bgcolor: c.year === year ? '#f3e5f5' : 'inherit',
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

      {/* ============ 年タブ ============ */}
      <Paper sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Tabs
            value={year}
            onChange={(_e, v: YearKey) => setYear(v)}
            textColor="inherit"
            sx={{ '& .MuiTab-root': { fontWeight: 'bold', color: PURPLE }, '& .MuiTabs-indicator': { backgroundColor: PURPLE } }}
          >
            {YEARS.map((y) => (
              <Tab key={y} value={y} label={`${y}年`} />
            ))}
          </Tabs>
          <Button size="small" onClick={() => setAll(!allOpen)} sx={{ color: PURPLE, mr: 1 }}>
            {allOpen ? '詳細をすべて閉じる ◀' : '詳細をすべて開く ▶'}
          </Button>
        </Box>
      </Paper>

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
                  {year}年
                </TableCell>
                {MONTH_LABELS.map((label) => (
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
                    <TableCell colSpan={MONTH_LABELS.length + 3} sx={{ bgcolor: GROUP_BG }}>
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
