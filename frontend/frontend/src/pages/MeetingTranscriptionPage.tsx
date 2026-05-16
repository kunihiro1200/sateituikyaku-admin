import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack,
  Mic,
  Stop,
  ContentCopy as ContentCopyIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useAudioTranscription } from '../hooks/useAudioTranscription';

export default function MeetingTranscriptionPage() {
  const navigate = useNavigate();
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const {
    status,
    transcript,
    summary,
    error,
    summarizing,
    recordingSeconds,
    transcribeProgress,
    formatTime,
    startRecording,
    stopRecording,
    handleSummarize,
    clearError,
  } = useAudioTranscription();

  const copyText = (text: string, type: 'transcript' | 'summary') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'transcript') {
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 1500);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 1500);
      }
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBack />} variant="outlined" size="small" onClick={() => navigate('/work-tasks')}>
          業務依頼一覧に戻る
        </Button>
        <Typography variant="h6" fontWeight="bold">
          📋 議事録 文字起こし・要約
        </Typography>
      </Box>

      <Box sx={{ flex: 1, p: 3, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>{error}</Alert>}

        {/* 録音操作 */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>会議・打ち合わせを録音して議事録作成</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            「録音開始」を押して会議を始めてください。終わったら「録音停止」を押すと
            <br />
            WhisperAIが文字起こしし、「議事録作成」ボタンで要点をまとめます（長時間録音も対応）。
          </Typography>

          {status === 'idle' && (
            <Button variant="contained" color="primary" size="large" startIcon={<Mic />} onClick={startRecording}
              sx={{ px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}>
              録音開始
            </Button>
          )}

          {status === 'recording' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'error.main',
                  animation: 'blink 1s infinite',
                  '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
                <Typography color="error" fontWeight="bold" fontSize="1.1rem">録音中...</Typography>
                <Typography fontWeight="bold" fontSize="1.3rem" sx={{ fontVariantNumeric: 'tabular-nums', ml: 1 }}>
                  {formatTime(recordingSeconds)}
                </Typography>
              </Box>
              <Button variant="contained" color="error" size="large" startIcon={<Stop />} onClick={stopRecording}
                sx={{ px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}>
                録音停止
              </Button>
            </Box>
          )}

          {status === 'transcribing' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress />
              {transcribeProgress && transcribeProgress.total > 1 ? (
                <>
                  <Typography color="text.secondary">
                    文字起こし中... {transcribeProgress.done} / {transcribeProgress.total} チャンク完了
                  </Typography>
                  <Box sx={{ width: '100%', maxWidth: 400 }}>
                    <LinearProgress variant="determinate" value={(transcribeProgress.done / transcribeProgress.total) * 100} />
                  </Box>
                </>
              ) : (
                <Typography color="text.secondary">文字起こし中... しばらくお待ちください</Typography>
              )}
            </Box>
          )}

          {status === 'done' && (
            <Button variant="outlined" startIcon={<Mic />} onClick={startRecording} size="medium">
              もう一度録音する
            </Button>
          )}
        </Paper>

        {/* 文字起こし結果 */}
        {transcript && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" fontWeight="bold">📝 文字起こし結果</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Tooltip title={copiedTranscript ? 'コピーしました！' : 'コピー'}>
                  <IconButton size="small" onClick={() => copyText(transcript, 'transcript')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {copiedTranscript && <Typography variant="body2" color="success.main" fontWeight="bold">✓ コピー済み</Typography>}
                <Button variant="contained" color="success"
                  startIcon={summarizing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => handleSummarize('meeting')} disabled={summarizing} sx={{ fontWeight: 'bold' }}>
                  {summarizing ? '作成中...' : '議事録作成'}
                </Button>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" component="pre"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.8,
                maxHeight: 400, overflowY: 'auto', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              {transcript}
            </Typography>
          </Paper>
        )}

        {/* 議事録結果 */}
        {summary && (
          <Paper sx={{ p: 3, border: 2, borderColor: 'success.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" fontWeight="bold" color="success.main">📋 議事録</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Tooltip title={copiedSummary ? 'コピーしました！' : 'コピー'}>
                  <IconButton size="small" onClick={() => copyText(summary, 'summary')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {copiedSummary && <Typography variant="body2" color="success.main" fontWeight="bold">✓ コピー済み</Typography>}
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" component="pre"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.8,
                bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              {summary}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
