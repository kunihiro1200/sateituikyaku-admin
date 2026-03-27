import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
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
  /** 表示対象のイニシャル一覧（未指定時は全件表示） */
  allowedInitials?: string[];
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
const EXCLUDED_INITIALS = new Set(['K', 'TENANT']);
// 除外するイニシャルのパターン（部分一致）
const EXCLUDED_PATTERNS = ['1度目不通', '不要', '1度目で通電OK'];

function isExcluded(initial: string): boolean {
  if (EXCLUDED_INITIALS.has(initial)) return true;
  if (initial.includes('TENANT')) return true;
  return EXCLUDED_PATTERNS.some((p) => initial.includes(p));
}

const CallRankingDisplay = ({ allowedInitials }: CallRankingDisplayProps) => {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchRanking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/sellers/call-ranking', { timeout: 5000 });
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
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // 期間表示（例: 2026年4月）
  const formatPeriod = (from: string): string => {
    const [year, month] = from.split('-');
    return `${year}年${parseInt(month)}月`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!data || data.rankings.length === 0) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
        <TrophyIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          今月はまだ記録がありません
        </Typography>
      </Paper>
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
      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
        <TrophyIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          今月はまだ記録がありません
        </Typography>
      </Paper>
    );
  }

  const maxCount = filteredRankings[0].count;
  const visibleRankings = expanded ? filteredRankings : filteredRankings.slice(0, DISPLAY_LIMIT);
  const hasMore = filteredRankings.length > DISPLAY_LIMIT;

  return (
    <Box>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
          <TrophyIcon sx={{ fontSize: 18, color: '#F57F17' }} />
          1番電話月間ランキング
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            {formatPeriod(data.period.from)}
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
          {expanded ? '折りたたむ' : `残り${data.rankings.length - DISPLAY_LIMIT}名を表示`}
        </Button>
      )}
    </Box>
  );
};

export default CallRankingDisplay;
