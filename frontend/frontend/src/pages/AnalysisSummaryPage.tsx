/**
 * 📄 分析サマリーページ
 * AI分析テキスト＋Q&A回答を材料にClaudeが統合要約文を生成して表示
 * 後輩スタッフ向けの学習まとめとして印刷・共有できる
 * @updated 2026-07-05
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, CircularProgress, Alert, Button, LinearProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PrintIcon from '@mui/icons-material/Print';
import api from '../services/api';

interface SummaryData {
  assignee: string;
  monthLabel: string;
  type: 'exclusive' | 'other';
  summaryText: string;
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

  const apiUrl = isExclusive
    ? `/api/sellers/${id}/exclusive-analysis/summary`
    : `/api/sellers/${id}/other-decision-analysis/summary`;

  useEffect(() => {
    if (!id) return;
    api.get(apiUrl)
      .then(res => setData(res.data))
      .catch(err => setError(err?.response?.data?.error || 'サマリーの生成に失敗しました'))
      .finally(() => setLoading(false));
  }, [id, apiUrl]);

  const th = isExclusive
    ? { primary: '#ff6d00', light: '#fff3e0', border: '#ffb74d', dark: '#e65100' }
    : { primary: '#e53935', light: '#fce4ec', border: '#ef9a9a', dark: '#c62828' };

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
        {!loading && data && (
          <Button
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            variant="contained"
            size="small"
            sx={{ bgcolor: th.primary, '&:hover': { bgcolor: th.dark }, ml: 'auto' }}
          >
            印刷 / PDF保存
          </Button>
        )}
      </Box>

      {/* ローディング */}
      {loading && (
        <Box>
          <LinearProgress color={isExclusive ? 'warning' : 'error'} sx={{ mb: 2, borderRadius: 1 }} />
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: th.light, border: `1px solid ${th.border}` }}>
            <CircularProgress sx={{ color: th.primary, mb: 2 }} />
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: th.dark, mb: 0.5 }}>
              AIがサマリーを生成中...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI分析と質問への回答を統合しています（10〜20秒）
            </Typography>
          </Paper>
        </Box>
      )}

      {/* エラー */}
      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button size="small" onClick={() => { setLoading(true); setError(null); api.get(apiUrl).then(res => setData(res.data)).catch(e => setError(e?.response?.data?.error || '失敗')).finally(() => setLoading(false)); }} sx={{ ml: 2 }}>
            再試行
          </Button>
        </Alert>
      )}

      {/* サマリー本体 */}
      {!loading && data && (
        <>
          {/* ヘッダー */}
          <Paper sx={{ p: 2.5, mb: 3, bgcolor: th.light, borderLeft: `5px solid ${th.primary}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              {isExclusive
                ? <EmojiEventsIcon sx={{ color: th.primary, fontSize: 28 }} />
                : <TrendingDownIcon sx={{ color: th.primary, fontSize: 28 }} />
              }
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: th.dark }}>
                {isExclusive ? '専任取得' : '他決'}　学習まとめ
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">担当者</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: th.primary, lineHeight: 1.2 }}>
                  {data.assignee}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">対象月</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                  {data.monthLabel}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* AI生成サマリー本文 */}
          <Paper
            elevation={2}
            sx={{
              border: `1.5px solid ${th.border}`,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            {/* タイトルバー */}
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: th.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: '#fff', fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#fff', flex: 1 }}>
                {isExclusive
                  ? `${data.assignee}の専任取得まとめ（後輩スタッフ向け）`
                  : `${data.assignee}の他決から学ぶポイント（後輩スタッフ向け）`
                }
              </Typography>
              <Chip
                label="AI生成"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 'bold', fontSize: '0.7rem' }}
              />
            </Box>

            {/* 本文 */}
            <Box sx={{ px: 3, py: 3, bgcolor: th.light }}>
              <Typography
                variant="body1"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 2.1, color: '#2c2c2c', fontSize: '0.92rem' }}
              >
                {data.summaryText}
              </Typography>
            </Box>
          </Paper>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              このまとめはAI分析と担当者の回答を統合してAIが生成しました
            </Typography>
          </Box>
        </>
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
