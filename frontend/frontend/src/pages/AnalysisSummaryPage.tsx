/**
 * 📄 分析サマリーページ
 * 専任分析・他決分析の「AI分析」と「Q&A回答」を1枚にまとめた共有・印刷向けページ
 * /sellers/:id/exclusive-analysis/summary
 * /sellers/:id/other-decision-analysis/summary
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button,
  Divider, Card, CardContent,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import QuizIcon from '@mui/icons-material/Quiz';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PrintIcon from '@mui/icons-material/Print';
import api from '../services/api';

interface SummaryData {
  assignee: string;
  monthLabel: string;
  type: 'exclusive' | 'other';
  aiAnalysis: string;
  qaPairs: { question: string; answer: string }[];
}

export default function AnalysisSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // パスから専任か他決かを判定
  const isExclusive = location.pathname.includes('exclusive-analysis');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backPath = isExclusive
    ? `/sellers/${id}/exclusive-analysis`
    : `/sellers/${id}/other-decision-analysis`;

  const summaryApiUrl = isExclusive
    ? `/api/sellers/${id}/exclusive-analysis/summary`
    : `/api/sellers/${id}/other-decision-analysis/summary`;

  useEffect(() => {
    if (!id) return;
    api.get(summaryApiUrl)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'データ取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [id, summaryApiUrl]);

  // テーマカラー
  const theme = isExclusive
    ? { primary: '#ff6d00', light: '#fff3e0', border: '#ffb74d', dark: '#e65100', chipBg: '#ff6d00' }
    : { primary: '#e53935', light: '#fce4ec', border: '#ef9a9a', dark: '#c62828', chipBg: '#e53935' };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 8 }}>
        <CircularProgress sx={{ color: theme.primary }} />
        <Typography color="text.secondary">サマリーを読み込み中...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backPath)} variant="outlined">
          分析ページに戻る
        </Button>
      </Box>
    );
  }

  const hasContent = data && (data.aiAnalysis || data.qaPairs.length > 0);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, sm: 3 } }}>

      {/* ツールバー（印刷時非表示） */}
      <Box
        sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}
        className="no-print"
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backPath)}
          variant="outlined"
          size="small"
          sx={{ borderColor: theme.primary, color: theme.primary }}
        >
          分析ページに戻る
        </Button>
        <Button
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          variant="contained"
          size="small"
          sx={{ bgcolor: theme.primary, '&:hover': { bgcolor: theme.dark }, ml: 'auto' }}
        >
          印刷 / PDF保存
        </Button>
      </Box>

      {/* ヘッダー */}
      <Paper
        sx={{
          p: 2.5, mb: 3,
          bgcolor: theme.light,
          borderLeft: `5px solid ${theme.primary}`,
          '@media print': { borderLeft: `5px solid ${theme.primary}` },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {isExclusive
            ? <EmojiEventsIcon sx={{ color: theme.primary, fontSize: 28 }} />
            : <TrendingDownIcon sx={{ color: theme.primary, fontSize: 28 }} />
          }
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.dark }}>
            {isExclusive ? '専任取得分析' : '他決分析'}　サマリー
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">担当者</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.primary, lineHeight: 1.2 }}>
              {data?.assignee ?? '－'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">対象月</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              {data?.monthLabel ?? '－'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {!hasContent ? (
        <Alert severity="info">
          AI分析・Q&A回答のデータがまだありません。分析ページで回答を入力・保存してから、このページを開いてください。
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* AI分析セクション */}
          {data?.aiAnalysis && (
            <Card sx={{ border: `1px solid ${theme.border}`, bgcolor: theme.light, boxShadow: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <AutoAwesomeIcon sx={{ color: theme.dark }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: theme.dark }}>
                    {isExclusive
                      ? `AI分析：${data.assignee}の強みと専任取得の秘訣`
                      : `AI分析：${data.assignee}の他決パターンと改善ポイント`
                    }
                  </Typography>
                  <Chip
                    label={isExclusive ? '秘訣' : '改善ポイント'}
                    size="small"
                    sx={{ bgcolor: theme.chipBg, color: '#fff', fontWeight: 'bold', ml: 'auto' }}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: '#333' }}
                >
                  {data.aiAnalysis}
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Q&A回答セクション */}
          {data && data.qaPairs.length > 0 && (
            <Card sx={{ border: '1px solid #c8e6c9', bgcolor: '#f1f8e9', boxShadow: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <QuizIcon sx={{ color: '#2e7d32' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#1b5e20' }}>
                    {data.assignee}への質問と回答
                  </Typography>
                  <Chip
                    label={`${data.qaPairs.length}問`}
                    size="small"
                    sx={{ bgcolor: '#2e7d32', color: '#fff', fontWeight: 'bold', ml: 'auto' }}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {data.qaPairs.map((pair, idx) => (
                    <Box key={idx}>
                      {/* 質問 */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
                        <Chip
                          label={`Q${idx + 1}`}
                          size="small"
                          sx={{
                            bgcolor: '#43a047', color: '#fff', fontWeight: 'bold',
                            minWidth: 36, flexShrink: 0, mt: 0.2,
                          }}
                        />
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 'bold', color: '#1b5e20', lineHeight: 1.6 }}
                        >
                          {pair.question}
                        </Typography>
                      </Box>
                      {/* 回答 */}
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2, ml: 0.5,
                          bgcolor: '#fff',
                          borderColor: '#a5d6a7',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                          💬 {data.assignee}の回答
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, color: '#333' }}
                        >
                          {pair.answer}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

        </Box>
      )}

      {/* 印刷スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          @page { margin: 15mm; }
        }
      `}</style>
    </Box>
  );
}
