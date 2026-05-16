import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import api from '../services/api';

// マイク録音状態の型
type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'done';

// 1チャンク最大60秒（Vercelタイムアウト対策）
const CHUNK_DURATION_MS = 60 * 1000;

/**
 * Blobを最大durationMsずつのチャンクに分割する
 * MediaRecorderは時間ベースでチャンクを取れないため、
 * ファイルサイズで均等分割してWhisperに渡す
 */
async function splitBlobIntoChunks(blob: Blob, mimeType: string, chunkCount: number): Promise<Blob[]> {
  if (chunkCount <= 1) return [blob];
  const chunkSize = Math.ceil(blob.size / chunkCount);
  const chunks: Blob[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, blob.size);
    chunks.push(blob.slice(start, end, mimeType));
  }
  return chunks;
}

/**
 * 1つのBlobをWhisper APIで文字起こし
 */
async function transcribeChunk(blob: Blob, mimeType: string, index: number): Promise<string> {
  const formData = new FormData();
  const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
  formData.append('audio', blob, `recording_${index}.${ext}`);

  const res = await api.post('/api/summarize/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });
  return res.data?.transcript || '';
}

export default function CallTranscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [sellerName, setSellerName] = useState<string>('');

  // 録音時間カウンター（refでも持つことでonstopクロージャ内から最新値を取得）
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 分割処理の進捗
  const [transcribeProgress, setTranscribeProgress] = useState<{ done: number; total: number } | null>(null);

  // 録音用 ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  // 売主名を取得（ページタイトル用）
  useEffect(() => {
    if (!id) return;
    api.get(`/api/sellers/${id}`)
      .then((res) => {
        const name = res.data?.name || res.data?.seller?.name || '';
        setSellerName(name);
      })
      .catch(() => {/* 失敗しても問題なし */});
  }, [id]);

  // タイマー開始・停止
  const startTimer = useCallback(() => {
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        const next = s + 1;
        recordingSecondsRef.current = next;
        return next;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 録音時間のフォーマット（mm:ss）
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 録音停止 → チャンク分割 → 並列文字起こし
  const processAndTranscribe = useCallback(async (blob: Blob, mimeType: string, durationSec: number) => {
    if (blob.size === 0) {
      setError('録音データが空です。もう一度お試しください。');
      setStatus('idle');
      return;
    }

    setStatus('transcribing');
    setTranscribeProgress(null);

    try {
      // 60秒ごとに分割（例：5分 → 5チャンク）
      const chunkCount = Math.max(1, Math.ceil(durationSec / 60));

      if (chunkCount === 1) {
        // 1チャンクはそのまま送信
        setTranscribeProgress({ done: 0, total: 1 });
        const text = await transcribeChunk(blob, mimeType, 0);
        setTranscribeProgress({ done: 1, total: 1 });
        setTranscript(text);
      } else {
        // 複数チャンクに分割して並列送信
        const chunks = await splitBlobIntoChunks(blob, mimeType, chunkCount);
        setTranscribeProgress({ done: 0, total: chunks.length });

        // 並列で全チャンクを送信（完了したものから進捗を更新）
        const results = await Promise.all(
          chunks.map((chunk, i) =>
            transcribeChunk(chunk, mimeType, i).then((text) => {
              setTranscribeProgress((prev) =>
                prev ? { done: prev.done + 1, total: prev.total } : null
              );
              return { index: i, text };
            })
          )
        );

        // 順番通りに結合
        const combined = results
          .sort((a, b) => a.index - b.index)
          .map((r) => r.text)
          .join(' ');
        setTranscript(combined);
      }

      setStatus('done');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '文字起こしに失敗しました';
      setError(msg);
      setStatus('idle');
    } finally {
      setTranscribeProgress(null);
    }
  }, []);

  // 録音開始
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    setSummary('');
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // サポートされている mimeType を選択
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';
      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopTimer();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        // refから最新の録音秒数を取得（クロージャ問題を回避）
        await processAndTranscribe(blob, mimeTypeRef.current, recordingSecondsRef.current);
      };

      mediaRecorder.start(1000); // 1秒ごとにチャンクを収集
      setStatus('recording');
      startTimer();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      } else {
        setError(`マイクの起動に失敗しました: ${err.message}`);
      }
    }
  }, [startTimer, stopTimer, processAndTranscribe, recordingSeconds]);

  // 録音停止
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    stopTimer();
  }, [stopTimer]);

  // 要約
  const handleSummarize = useCallback(async () => {
    if (!transcript.trim()) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await api.post('/api/summarize/summarize-transcript', {
        transcript,
        sellerName: sellerName || undefined,
      });
      setSummary(res.data?.summary || '');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '要約に失敗しました';
      setError(msg);
    } finally {
      setSummarizing(false);
    }
  }, [transcript, sellerName]);

  // コピー
  const copyText = useCallback((text: string, type: 'transcript' | 'summary') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'transcript') {
        setCopiedTranscript(true);
        setTimeout(() => setCopiedTranscript(false), 1500);
      } else {
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 1500);
      }
    });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          variant="outlined"
          size="small"
          onClick={() => navigate(`/sellers/${id}/call`)}
        >
          通話モードに戻る
        </Button>
        <Typography variant="h6" fontWeight="bold">
          通話文字起こし
          {sellerName && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {sellerName}
            </Typography>
          )}
        </Typography>
      </Box>

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, p: 3, maxWidth: 900, mx: 'auto', width: '100%' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 録音操作 */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            通話を録音して文字起こし
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            電話が終わった後に「録音開始」を押して、通話内容をマイクに向かって話してください。
            <br />
            終わったら「録音停止」→ WhisperAIが文字起こしします（長時間録音も対応）。
          </Typography>

          {status === 'idle' && (
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Mic />}
              onClick={startRecording}
              sx={{ px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
            >
              録音開始
            </Button>
          )}

          {status === 'recording' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    animation: 'blink 1s infinite',
                    '@keyframes blink': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.2 },
                    },
                  }}
                />
                <Typography color="error" fontWeight="bold" fontSize="1.1rem">
                  録音中...
                </Typography>
                {/* 録音時間カウンター */}
                <Typography
                  fontWeight="bold"
                  fontSize="1.3rem"
                  sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.primary', ml: 1 }}
                >
                  {formatTime(recordingSeconds)}
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<Stop />}
                onClick={stopRecording}
                sx={{ px: 5, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
              >
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
                    <LinearProgress
                      variant="determinate"
                      value={(transcribeProgress.done / transcribeProgress.total) * 100}
                    />
                  </Box>
                </>
              ) : (
                <Typography color="text.secondary">文字起こし中... しばらくお待ちください</Typography>
              )}
            </Box>
          )}

          {status === 'done' && (
            <Button
              variant="outlined"
              startIcon={<Mic />}
              onClick={startRecording}
              size="medium"
            >
              もう一度録音する
            </Button>
          )}
        </Paper>

        {/* 文字起こし結果 */}
        {transcript && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" fontWeight="bold">
                📝 文字起こし結果
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Tooltip title={copiedTranscript ? 'コピーしました！' : 'コピー'}>
                  <IconButton size="small" onClick={() => copyText(transcript, 'transcript')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {copiedTranscript && (
                  <Typography variant="body2" color="success.main" fontWeight="bold">
                    ✓ コピー済み
                  </Typography>
                )}
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={summarizing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={handleSummarize}
                  disabled={summarizing}
                  sx={{ fontWeight: 'bold' }}
                >
                  {summarizing ? '要約中...' : '要約'}
                </Button>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography
              variant="body1"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                lineHeight: 1.8,
                maxHeight: 400,
                overflowY: 'auto',
                bgcolor: 'grey.50',
                p: 2,
                borderRadius: 1,
              }}
            >
              {transcript}
            </Typography>
          </Paper>
        )}

        {/* AI要約結果 */}
        {summary && (
          <Paper sx={{ p: 3, border: 2, borderColor: 'secondary.main' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="h6" fontWeight="bold" color="secondary.main">
                ✨ AI要約
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Tooltip title={copiedSummary ? 'コピーしました！' : 'コピー'}>
                  <IconButton size="small" onClick={() => copyText(summary, 'summary')}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {copiedSummary && (
                  <Typography variant="body2" color="success.main" fontWeight="bold">
                    ✓ コピー済み
                  </Typography>
                )}
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography
              variant="body1"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
                lineHeight: 1.8,
                bgcolor: 'secondary.50',
                p: 2,
                borderRadius: 1,
              }}
            >
              {summary}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
