import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Collapse, IconButton, TextField, Paper, CircularProgress, Badge } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SendIcon from '@mui/icons-material/Send';
import { sellerPortalApi } from '../../services/sellerPortalApi';

interface Message {
  id: string;
  sender_type: 'seller' | 'staff';
  content: string;
  created_at: string;
}

/**
 * 各セクション（査定額・査定根拠・手残り・スケジュール）カードの下に埋め込む、
 * その場で開閉するインラインチャット。
 *
 * 以前はボタンを押すと全画面モーダルが開き、上のセクション内容が見えなくなっていた。
 * ユーザー要望により、矢印アイコンで下に開閉する形にし、セクション内容を見ながら
 * 質問できるようにする（画面遷移せず、下にスクロールして展開するだけ）。
 */
export default function InlineChatSection({
  token,
  contextTag,
  label,
  hasUnreadReply,
  onMessagesRead,
}: {
  token: string;
  contextTag: string;
  /** 折りたたみ部分のラベル（例: 「この査定額について質問する」） */
  label: string;
  /** スタッフからこの相談元への未読返信があるか（あれば赤丸を表示する） */
  hasUnreadReply?: boolean;
  /** 開いて既読になったタイミングで呼ばれる。ページ側の未読状態（FAB・各カードの赤丸）を再取得させる */
  onMessagesRead?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    (async () => {
      setLoading(true);
      try {
        const res = await sellerPortalApi.getMessages(token);
        const conv = res.conversations.find((c: any) => c.context_tag === contextTag);
        setMessages(conv?.messages ?? []);
        // 開いたことで既読になったので、ページ側の未読状態（FAB・各カードの赤丸）を再取得させる
        onMessagesRead?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded, token, contextTag, onMessagesRead]);

  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, expanded]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, sender_type: 'seller', content, created_at: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      await sellerPortalApi.sendMessage(token, contextTag, content);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none' }}
      >
        <Badge color="error" variant="dot" invisible={!hasUnreadReply}>
          <Typography variant="body2" color="primary" fontWeight="bold">
            {label}
          </Typography>
        </Badge>
        <IconButton size="small" sx={{ ml: 'auto' }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 1, border: '1px solid #eee', borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ maxHeight: 260, overflowY: 'auto', p: 1.5 }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
            {!loading && messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                ご質問があれば、下の入力欄からスタッフにメッセージを送ってください。
              </Typography>
            )}
            {messages.map((m) => (
              <Box
                key={m.id}
                sx={{ display: 'flex', justifyContent: m.sender_type === 'seller' ? 'flex-end' : 'flex-start', mb: 1 }}
              >
                <Paper
                  sx={{
                    px: 1.5,
                    py: 1,
                    maxWidth: '80%',
                    bgcolor: m.sender_type === 'seller' ? '#0B2545' : 'white',
                    color: m.sender_type === 'seller' ? 'white' : 'text.primary',
                    whiteSpace: 'pre-wrap',
                  }}
                  variant={m.sender_type === 'seller' ? 'elevation' : 'outlined'}
                >
                  <Typography variant="body2">{m.content}</Typography>
                </Paper>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>
          <Box sx={{ p: 1, borderTop: '1px solid #eee', display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="メッセージを入力"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <IconButton color="primary" onClick={handleSend} disabled={!input.trim() || sending}>
              <SendIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
