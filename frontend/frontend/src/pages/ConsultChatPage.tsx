import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { consultApi } from '../services/consultApi';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 不動産相談チャットアプリ：チャット画面（認証不要・顧客向け公開ページ）。
 * 吹き出し形式でLLM（Claude）とやり取りする。謄本の写メはカメラ起動可能な
 * input[type=file][capture=environment] から取得し、既存のTokiExtractService経由で解析する。
 */
export default function ConsultChatPage() {
  const { sellerNumber } = useParams<{ sellerNumber: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingToki, setUploadingToki] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const stored = consultApi.getStoredSession();
      if (!stored || stored.sellerNumber !== sellerNumber) {
        navigate('/consult/verify', { replace: true });
        return;
      }
      const resolved = await consultApi.resolveSession(stored.token);
      if (!resolved) {
        consultApi.clearSession();
        navigate('/consult/verify', { replace: true });
        return;
      }
      setSellerId(resolved.sellerId);
      try {
        const conv = await consultApi.startConversation(resolved.sellerId, resolved.sellerNumber);
        setConversationId(conv.conversationId);
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content:
              '不動産に関するご相談をどうぞ。譲渡所得税、仲介手数料、契約に関することなど、何でもお聞きください。\n謄本の写真をアップロードすると、物件情報を踏まえた回答ができます（📷ボタン）。',
          },
        ]);
      } catch (err: any) {
        setError(err.message || '会話の開始に失敗しました');
      } finally {
        setInitializing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerNumber]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !sellerId || !conversationId || sending) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: userMessage }]);
    setSending(true);
    setError('');
    try {
      const result = await consultApi.sendChat(sellerId, sellerNumber!, conversationId, userMessage);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: result.reply }]);
    } catch (err: any) {
      setError(err.message || '送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !sellerId) return;

    setUploadingToki(true);
    setError('');
    try {
      const encoded = await Promise.all(
        Array.from(files).map(
          (file) =>
            new Promise<{ name: string; mimeType: string; base64: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1] ?? '';
                resolve({ name: file.name, mimeType: file.type || 'image/jpeg', base64 });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      );

      setMessages((prev) => [
        ...prev,
        { id: `u-toki-${Date.now()}`, role: 'user', content: `📷 謄本の写真を送信しました（${encoded.length}枚）` },
      ]);

      const result = await consultApi.uploadToki(sellerId, sellerNumber!, encoded);
      const p = result.profile;
      const summary = [
        p.ownerName ? `所有者名: ${p.ownerName}` : null,
        p.ownerAddress ? `所有者住所: ${p.ownerAddress}` : null,
        p.acquisitionDate ? `取得日: ${p.acquisitionDate}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      setMessages((prev) => [
        ...prev,
        {
          id: `a-toki-${Date.now()}`,
          role: 'assistant',
          content: summary
            ? `謄本を読み取りました。\n${summary}\nこの情報を踏まえてご相談にお答えします。`
            : '謄本の読み取りを試みましたが、情報を確認できませんでした。もう一度、文字がはっきり見えるように撮影してお試しください。',
        },
      ]);
    } catch (err: any) {
      setError(err.message || '謄本の読み取りに失敗しました');
    } finally {
      setUploadingToki(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#eef1f5' }}>
      <Box sx={{ bgcolor: 'white', px: 2, py: 1.5, borderBottom: '1px solid #ddd' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          不動産相談チャット
        </Typography>
        <Typography variant="caption" color="text.secondary">
          売主番号: {sellerNumber}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {messages.map((m) => (
          <Box
            key={m.id}
            sx={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 1.5,
            }}
          >
            {m.role === 'assistant' && (
              <Avatar sx={{ bgcolor: '#1565c0', width: 28, height: 28, mr: 1, fontSize: 14 }}>AI</Avatar>
            )}
            <Paper
              sx={{
                px: 2,
                py: 1,
                maxWidth: '75%',
                borderRadius: 2,
                bgcolor: m.role === 'user' ? '#1565c0' : 'white',
                color: m.role === 'user' ? 'white' : 'text.primary',
                whiteSpace: 'pre-wrap',
              }}
              elevation={1}
            >
              <Typography variant="body2">{m.content}</Typography>
            </Paper>
          </Box>
        ))}
        {(sending || uploadingToki) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 4 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              {uploadingToki ? '謄本を読み取っています...' : '回答を作成しています...'}
            </Typography>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {error && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        </Box>
      )}

      <Box sx={{ bgcolor: 'white', borderTop: '1px solid #ddd', p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={handleFileSelected}
        />
        <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploadingToki} color="primary">
          <PhotoCameraIcon />
        </IconButton>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          placeholder="メッセージを入力"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <IconButton onClick={handleSend} disabled={sending || !input.trim()} color="primary">
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
