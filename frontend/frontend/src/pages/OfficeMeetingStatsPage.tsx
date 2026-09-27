import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import PageNavigation from '../components/PageNavigation';
import { SECTION_COLORS } from '../theme/sectionColors';
import api from '../services/api';

interface Metric {
  key: string;
  label: string;
}

interface StatsRow {
  initial: string;
  counts: Record<string, number>;
  total: number;
}

interface MonthStats {
  month: string; // 'YYYY-MM'
  rows: StatsRow[];
  totals: Record<string, number>;
}

interface StatsData {
  metrics: Metric[];
  months: MonthStats[];
  availableMonths: string[];
  updatedAt: string;
}

// 'YYYY-MM' → '2026年9月'
function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  if (!y || !m) return month;
  return `${y}年${parseInt(m, 10)}月`;
}

export default function OfficeMeetingStatsPage() {
  const sharedItemsColor = SECTION_COLORS.sharedItems;
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/work-tasks/office-meeting-stats');
      const payload: StatsData = res.data;
      setData(payload);
      // 最新月（配列先頭）をデフォルト選択
      if (payload.availableMonths && payload.availableMonths.length > 0) {
        setSelectedMonth((prev) =>
          prev && payload.availableMonths.includes(prev) ? prev : payload.availableMonths[0]
        );
      } else {
        setSelectedMonth('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || '集計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const currentMonth: MonthStats | null = useMemo(() => {
    if (!data) return null;
    return data.months.find((m) => m.month === selectedMonth) || null;
  }, [data, selectedMonth]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
          事務作業集計（スタッフ別・月ごと）
        </Typography>
        <Tooltip title="再読み込み">
          <IconButton onClick={fetchStats} size="small" disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        {data && data.availableMonths.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="office-stats-month-label">集計月</InputLabel>
            <Select
              labelId="office-stats-month-label"
              label="集計月"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {data.availableMonths.map((m) => (
                <MenuItem key={m} value={m}>
                  {formatMonthLabel(m)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {selectedMonth && (
          <Chip
            size="small"
            label={formatMonthLabel(selectedMonth)}
            sx={{ bgcolor: sharedItemsColor.light, color: '#fff' }}
          />
        )}
        {data && (
          <Typography variant="caption" color="text.secondary">
            更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}
          </Typography>
        )}
      </Box>

      <PageNavigation />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
        業務依頼の各担当対応数と、送信したメール対応数（値下げ対応・レインズ対応のみ）を月ごと・スタッフ別に集計しています。
      </Typography>

      <Box sx={{ mt: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !data || !data.availableMonths.length ? (
          <Alert severity="info">集計データがありません。</Alert>
        ) : !currentMonth || currentMonth.rows.length === 0 ? (
          <Alert severity="info">{formatMonthLabel(selectedMonth)}の集計データがありません。</Alert>
        ) : (
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.light, color: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                    スタッフ
                  </TableCell>
                  {data.metrics.map((m) => (
                    <TableCell
                      key={m.key}
                      align="center"
                      sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.light, color: '#fff', whiteSpace: 'nowrap' }}
                    >
                      {m.label}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.main, color: '#fff' }}>
                    合計
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentMonth.rows.map((row) => (
                  <TableRow key={row.initial} hover>
                    <TableCell sx={{ fontWeight: 'bold', position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 2 }}>
                      {row.initial}
                    </TableCell>
                    {data.metrics.map((m) => {
                      const v = row.counts[m.key] || 0;
                      return (
                        <TableCell key={m.key} align="center" sx={{ color: v === 0 ? 'text.disabled' : 'text.primary' }}>
                          {v}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>
                      {row.total}
                    </TableCell>
                  </TableRow>
                ))}
                {/* 合計行 */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', position: 'sticky', left: 0, bgcolor: '#eceff1', zIndex: 2 }}>
                    合計
                  </TableCell>
                  {data.metrics.map((m) => (
                    <TableCell key={m.key} align="center" sx={{ fontWeight: 'bold', bgcolor: '#eceff1' }}>
                      {currentMonth.totals[m.key] || 0}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.main, color: '#fff' }}>
                    {Object.values(currentMonth.totals).reduce((a, b) => a + b, 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        )}
      </Box>
    </Container>
  );
}
