import { useState, useRef, useCallback } from 'react';
import api from '../services/api';

// 録音状態の型
export type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'done';

// 1チャンクの最大サイズ（Whisper API上限25MBに対して余裕を持たせた3MB）
// 2時間録音 ≈ 150MB → 約50チャンク
const MAX_CHUNK_BYTES = 3 * 1024 * 1024; // 3MB

// 並列送信の最大数（レートリミット対策）
const MAX_PARALLEL = 5;

/**
 * Blobをサイズベースで分割する（Whisper API 25MB制限対策）
 */
function splitBlobBySize(blob: Blob, mimeType: string): Blob[] {
  if (blob.size <= MAX_CHUNK_BYTES) return [blob];
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + MAX_CHUNK_BYTES, blob.size);
    chunks.push(blob.slice(offset, end, mimeType));
    offset = end;
  }
  return chunks;
}

/**
 * 1チャンクをWhisper APIで文字起こし
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

/**
 * 録音 → チャンク分割 → 並列文字起こし → GPT要約
 * 通話文字起こしページと議事録ページの両方で使う共通フック
 */
export function useAudioTranscription(sellerName?: string) {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribeProgress, setTranscribeProgress] = useState<{ done: number; total: number } | null>(null);

  // 内部ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const recordingSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // タイマー
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

  // mm:ss フォーマット
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 音声Blobを受け取り → 分割 → 並列文字起こし（最大MAX_PARALLEL並列）
  const processAndTranscribe = useCallback(async (blob: Blob, mimeType: string, _durationSec: number) => {
    if (blob.size === 0) {
      setError('録音データが空です。もう一度お試しください。');
      setStatus('idle');
      return;
    }

    setStatus('transcribing');
    setTranscribeProgress(null);

    try {
      // サイズベースで分割（3MB上限）
      const chunks = splitBlobBySize(blob, mimeType);
      setTranscribeProgress({ done: 0, total: chunks.length });

      if (chunks.length === 1) {
        // 1チャンクはそのまま送信
        const text = await transcribeChunk(blob, mimeType, 0);
        setTranscribeProgress({ done: 1, total: 1 });
        setTranscript(text);
      } else {
        // 最大MAX_PARALLEL並列で送信（レートリミット対策）
        const results: { index: number; text: string }[] = [];

        for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
          const batch = chunks.slice(i, i + MAX_PARALLEL);
          const batchResults = await Promise.all(
            batch.map((chunk, batchIdx) => {
              const globalIdx = i + batchIdx;
              return transcribeChunk(chunk, mimeType, globalIdx).then((text) => {
                setTranscribeProgress((prev) =>
                  prev ? { done: prev.done + 1, total: prev.total } : null
                );
                return { index: globalIdx, text };
              });
            })
          );
          results.push(...batchResults);
        }

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
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopTimer();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        await processAndTranscribe(blob, mimeTypeRef.current, recordingSecondsRef.current);
      };

      mediaRecorder.start(1000);
      setStatus('recording');
      startTimer();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。');
      } else {
        setError(`マイクの起動に失敗しました: ${err.message}`);
      }
    }
  }, [startTimer, stopTimer, processAndTranscribe]);

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

  // GPT要約（用途に応じたpromptをバックエンドに渡せるようsummaryTypeで切り替え）
  const handleSummarize = useCallback(async (summaryType: 'call' | 'meeting' = 'call') => {
    if (!transcript.trim()) return;
    setSummarizing(true);
    setError(null);
    try {
      const res = await api.post('/api/summarize/summarize-transcript', {
        transcript,
        sellerName: sellerName || undefined,
        summaryType,
      });
      setSummary(res.data?.summary || '');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || '要約に失敗しました';
      setError(msg);
    } finally {
      setSummarizing(false);
    }
  }, [transcript, sellerName]);

  const clearError = useCallback(() => setError(null), []);

  return {
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
  };
}
