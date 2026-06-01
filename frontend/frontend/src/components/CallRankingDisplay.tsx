import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  LinearProgress,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import api from '../services/api';

interface RankingEntry {
  initial: string;
  count: number;
}

interface RankingData {
  period: { from: string; to: string };
  rankings: RankingEntry[];
  updatedAt: string;
}

interface CallRankingDisplayProps {
  /** ランキングのタイトル（デフォルト: "1番電話月間ランキング"） */
  title?: string;
  /** APIエンドポイント（デフォルト: "/api/sellers/call-ranking"） */
  endpoint?: string;
  /** 表示対象のイニシャル一覧（未指定時は全件表示） */
  allowedInitials?: string[];
  /** 年間累計表示モード（trueの場合、期間を "2026年1月〜YYYY年M月" 形式で表示） */
  yearlyMode?: boolean;
  /** 月選択プルダウンを表示するか（デフォルト: false） */
  showMonthSelector?: boolean;
}

// 順位ごとの色設定
const RANK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: '#FFF8E1', text: '#F57F17', border: '#FFD54F' },
  2: { bg: '#F5F5F5', text: '#616161', border: '#BDBDBD' },
  3: { bg: '#FBE9E7', text: '#BF360C', border: '#FFAB91' },
};

const DEFAULT_RANK_COLOR = { bg: '#FAFAFA', text: '#424242', border: '#E0E0E0' };

const DISPLAY_LIMIT = 5;

// ランキングから除外するイニシャル・文字列
const EXCLUDED_INITIALS = new Set(['TENANT']);
// 除外するイニシャルのパターン（部分一致）
const EXCLUDED_PATTERNS = ['1度目不通', '不要', '1度目で通電OK'];

function isExcluded(initial: string): boolean {
  if (EXCLUDED_INITIALS.has(initial)) return true;
  if (initial.includes('TENANT')) return true;
  return EXCLUDED_PATTERNS.some((p) => initial.includes(p));
}

// 月選択肢を生成（2026年1月から現在月まで）
function generateMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const currentYear = jstNow.getUTCFullYear();
  const currentMonth = jstNow.getUTCMonth(); // 0-indexed

  const options: { value: string; label: string }[] = [];
  // 2026年1月から現在月まで
  const startYear = 2026;
  const startMonth = 0; // 1月（0-indexed）

  for (let y = startYear; y <= currentYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === currentYear ? currentMonth : 11;
    for (let m = mStart; m <= mEnd; m++) {
      options.push({
        value: `${y}-${m + 1}`,
        label: `${y}年${m + 1}月`,
      });
    }
  }

  // 新しい月が先頭に来るように逆順にする
  return options.reverse();
}

const CallRankingDisplay = ({ title = '1番電話月間ランキング', endpoint = '/api/sellers/call-ranking', allowedInitials, yearlyMode = false, showMonthSelector = false }: CallRankingDisplayProps) => {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 月選択の状態（デフォルトは当月）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const [selectedMonth, setSelectedMonth] = useState<string>(`${jstNow.getUTCFullYear()}-${jstNow.getUTCMonth() + 1}`);

  const monthOptions = generateMonthOptions();

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = endpoint;
      if (showMonthSelector && selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const separator = endpoint.includes('?') ? '&' : '?';
        url = `${endpoint}${separator}year=${year}&month=${month}`;
      }
      const response = await api.get(url, { timeout: 5000 });
      setData(response.data);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('データの取得がタイムアウトしました');
      } else {
        setError(err.response?.data?.error?.message || 'ランキングの取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [endpoint, showMonthSelector, selectedMonth]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const handleMonthChange = (event: SelectChangeEvent<string>) => {
    setSelectedMonth(event.target.value);
  };

  // 期間表示（月間: "2026年4月"、年間: "2026年1月〜2026年4月"）
  const formatPeriod = (from: string, to?: string): string => {
    const [year, month] = from.split('-');
    if (yearlyMode && to) {
      const [toYear, toMonth] = to.split('-');
      return `${year}年${parseInt(month)}月〜${toYear}年${parseInt(toMonth)}月`;
    }
    return `${year}年${parseInt(month)}月`;
  };

  if (loading) {
    return (
      <Box>
        {/* 月選択プルダウン（ローディング中も表示） */}
        {showMonthSelector && (
          <Box sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedMonth}
                onChange={handleMonthChange}
                sx={{ fontSize: '0.875rem' }}
              >
                {monthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        {showMonthSelector && (
          <Box sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedMonth}
                onChange={handleMonthChange}
                sx={{ fontSize: '0.875rem' }}
              >
                {monthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchRanking} startIcon={<RefreshIcon />}>
              再試行
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data || data.rankings.length === 0) {
    return (
      <Box>
        {showMonthSelector && (
          <Box sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedMonth}
                onChange={handleMonthChange}
                sx={{ fontSize: '0.875rem' }}
              >
                {monthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
          <TrophyIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            この月はまだ記録がありません
          </Typography>
        </Paper>
      </Box>
    );
  }

  // 除外フィルタ + allowedInitials フィルタを適用
  const filteredRankings = data.rankings.filter((entry) => {
    if (isExcluded(entry.initial)) return false;
    if (allowedInitials && allowedInitials.length > 0) {
      return allowedInitials.includes(entry.initial);
    }
    return true;
  });

  if (filteredRankings.length === 0) {
    return (
      <Box>
        {showMonthSelector && (
          <Box sx={{ mb: 1.5 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={selectedMonth}
                onChange={handleMonthChange}
                sx={{ fontSize: '0.875rem' }}
              >
                {monthOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
          <TrophyIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            この月はまだ記録がありません
          </Typography>
        </Paper>
      </Box>
    );
  }

  const maxCount = filteredRankings[0].count;
  const visibleRankings = expanded ? filteredRankings : filteredRankings.slice(0, DISPLAY_LIMIT);
  const hasMore = filteredRankings.length > DISPLAY_LIMIT;

  return (
    <Box>
      {/* 月選択プルダウン */}
      {showMonthSelector && (
        <Box sx={{ mb: 1.5 }}>
          <FormControl size="small" fullWidth>
            <Select
              value={selectedMonth}
              onChange={handleMonthChange}
              sx={{ fontSize: '0.875rem' }}
            >
              {monthOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
          <TrophyIcon sx={{ fontSize: 18, color: '#F57F17' }} />
          {title}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {formatPeriod(data.period.from, data.period.to)}
          </Typography>
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchRanking} sx={{ minWidth: 0, px: 1 }}>
          更新
        </Button>
      </Box>

      {/* ランキングリスト */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {visibleRankings.map((entry, index) => {
          const rank = index + 1;
          const color = RANK_COLORS[rank] || DEFAULT_RANK_COLOR;
          const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;

          return (
            <Paper
              key={entry.initial}
              variant="outlined"
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: color.bg,
                borderColor: color.border,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {/* 順位 */}
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 'bold', color: color.text, minWidth: 20, textAlign: 'center' }}
                >
                  {rank === 1 ? '🏆' : `${rank}位`}
                </Typography>
                {/* イニシャル */}
                <Typography variant="body2" sx={{ fontWeight: rank <= 3 ? 'bold' : 'normal', flex: 1 }}>
                  {entry.initial}
                </Typography>
                {/* 件数 */}
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: color.text }}>
                  {entry.count}件
                </Typography>
              </Box>
              {/* 件数バー */}
              <LinearProgress
                variant="determinate"
                value={barWidth}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: `${color.border}80`,
                  '& .MuiLinearProgress-bar': { bgcolor: color.text },
                }}
              />
            </Paper>
          );
        })}
      </Box>

      {/* 折りたたみボタン */}
      {hasMore && (
        <Button
          size="small"
          fullWidth
          onClick={() => setExpanded(!expanded)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ mt: 0.5, color: 'text.secondary' }}
        >
          {expanded ? '折りたたむ' : `残り${filteredRankings.length - DISPLAY_LIMIT}名を表示`}
        </Button>
      )}
    </Box>
  );
};

export default CallRankingDisplay;
