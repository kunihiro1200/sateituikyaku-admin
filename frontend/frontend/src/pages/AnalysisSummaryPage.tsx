/**
 * 📄 分析サマリーページ
 * 専任分析・他決分析の「AI分析」と「Q&A回答」を1枚に統合した共有・印刷向けページ
 * AI分析の内容と担当者の回答を交互に並べ、後輩が読み通せるようにまとめる
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button, Divider,
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
  const th = isExclusive
    ? { primary: '#ff6d00', light: '#fff3e0', border: '#ffb74d', dark: '#e65100', headerBg: '#fff8f0' }
    : { primary: '#e53935', light: '#fce4ec', border: '#ef9a9a', dark: '#c62828', headerBg: '#fff5f5' };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 8 }}>
        <CircularProgress sx={{ color: th.primary }} />
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
      <Box className="no-print" sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(backPath)}
          variant="outlined"
          size="small"
          sx={{ borderColor: th.primary, color: th.primary }}
        >
          分析ページに戻る
        </Button>
        <Button
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          variant="contained"
          size="small"
          sx={{ bgcolor: th.primary, '&:hover': { bgcolor: th.dark }, ml: 'auto' }}
        >
          印刷 / PDF保存
        </Button>
      </Box>

      {/* ページヘッダー */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: th.headerBg, borderLeft: `5px solid ${th.primary}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          {isExclusive
            ? <EmojiEventsIcon sx={{ color: th.primary, fontSize: 28 }} />
            : <TrendingDownIcon sx={{ color: th.primary, fontSize: 28 }} />
          }
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: th.dark }}>
            {isExclusive ? '専任取得分析' : '他決分析'}　まとめ
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">担当者</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: th.primary, lineHeight: 1.2 }}>
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
          AI分析・Q&A回答のデータがまだありません。分析ページで回答を保存してからもう一度開いてください。
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ① AI分析セクション */}
          {data?.aiAnalysis && (
            <Paper
              elevation={0}
              sx={{
                border: `1.5px solid ${th.border}`,
                borderRadius: '12px 12px 0 0',
                borderBottom: 'none',
                overflow: 'hidden',
              }}
            >
              {/* セクションタイトルバー */}
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: th.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', flex: 1 }}>
                  {isExclusive
                    ? `AI分析：${data.assignee}の強みと専任取得の秘訣`
                    : `AI分析：${data.assignee}の他決パターンと改善ポイント`
                  }
                </Typography>
                <Chip
                  label="他スタッフへ共有"
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 'bold', fontSize: '0.7rem' }}
                />
              </Box>
              {/* AI分析本文 */}
              <Box sx={{ px: 3, py: 2.5, bgcolor: th.light }}>
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', lineHeight: 2, color: '#333', fontSize: '0.9rem' }}
                >
                  {data.aiAnalysis}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* ② Q&Aセクション */}
          {data && data.qaPairs.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                border: `1.5px solid ${th.border}`,
                borderTop: data?.aiAnalysis ? `1.5px solid ${th.border}` : `1.5px solid ${th.border}`,
                borderRadius: data?.aiAnalysis ? '0 0 12px 12px' : '12px',
                overflow: 'hidden',
              }}
            >
              {/* セクションタイトルバー */}
              <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#2e7d32', display: 'flex', alignItems: 'center', gap: 1 }}>
                <QuizIcon sx={{ color: '#fff', fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', flex: 1 }}>
                  {data.assignee}への質問と回答
                </Typography>
                <Chip
                  label={`${data.qaPairs.length}問`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 'bold', fontSize: '0.7rem' }}
                />
              </Box>

              {/* Q&A本文 */}
              <Box sx={{ bgcolor: '#f9fbe7' }}>
                {data.qaPairs.map((pair, idx) => (
                  <Box key={idx}>
                    {idx > 0 && <Divider sx={{ borderColor: '#c8e6c9' }} />}
                    <Box sx={{ px: 3, py: 2.5 }}>
                      {/* 質問 */}
                      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
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
                          sx={{ fontWeight: 'bold', color: '#1b5e20', lineHeight: 1.7, fontSize: '0.9rem' }}
                        >
                          {pair.question}
                        </Typography>
                      </Box>
                      {/* 回答 */}
                      <Box
                        sx={{
                          ml: 0.5, pl: 2.5,
                          borderLeft: '3px solid #66bb6a',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ color: '#2e7d32', fontWeight: 'bold', display: 'block', mb: 0.5 }}
                        >
                          💬 {data.assignee}の回答
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, color: '#333', fontSize: '0.88rem' }}
                        >
                          {pair.answer}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
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
