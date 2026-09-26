import { useState, useEffect, useCallback } from 'react';
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
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
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

interface StatsData {
  period: { month: string; from: string; to: string; allTime: boolean };
  metrics: Metric[];
  rows: StatsRow[];
  totals: Record<string, number>;
  updatedAt: string;
}

// 直近13ヶ月ぶんの月選択肢を生成（JST基準）
function buildMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  let y = jst.getUTCFullYear();
  let m = jst.getUTCMonth(); // 0-indexed
  for (let i = 0; i < 13; i++) {
    const value = `${y}-${String(m + 1).padStart(2, '0')}`;
    opts.push({ value, label: `${y}年${m + 1}月` });
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();
const ALL_TIME = 'all';

export default function OfficeMeetingStatsPage() {
  const sharedItemsColor = SECTION_COLORS.sharedItems;
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTH_OPTIONS[0]?.value || ALL_TIME);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedMonth === ALL_TIME ? {} : { month: selectedMonth };
      const res = await api.get('/api/work-tasks/office-meeting-stats', { params });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || '集計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleMonthChange = (e: SelectChangeEvent) => {
    setSelectedMonth(e.target.value);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: sharedItemsColor.main }}>
          事務作業集計（スタッフ別）
        </Typography>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select value={selectedMonth} onChange={handleMonthChange}>
            <MenuItem value={ALL_TIME}>全期間</MenuItem>
            {MONTH_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="再読み込み">
          <IconButton onClick={fetchStats} size="small" disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        {data && (
          <Chip
            size="small"
            label={data.period.allTime ? '全期間' : `${data.period.from} 〜 ${data.period.to}`}
            sx={{ bgcolor: sharedItemsColor.light, color: sharedItemsColor.main }}
          />
        )}
      </Box>

      <PageNavigation />

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
        業務依頼の各担当対応数と、送信したメール対応数（値下げ対応・レインズ対応のみ）をスタッフ別に集計しています。
      </Typography>

      <Box sx={{ mt: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !data || data.rows.length === 0 ? (
          <Alert severity="info">対象期間の集計データがありません。</Alert>
        ) : (
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.light, position: 'sticky', left: 0, zIndex: 3 }}>
                    スタッフ
                  </TableCell>
                  {data.metrics.map((m) => (
                    <TableCell
                      key={m.key}
                      align="center"
                      sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.light, whiteSpace: 'nowrap' }}
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
                {data.rows.map((row) => (
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
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.light }}>
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
                      {data.totals[m.key] || 0}
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: sharedItemsColor.main, color: '#fff' }}>
                    {Object.values(data.totals).reduce((a, b) => a + b, 0)}
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
