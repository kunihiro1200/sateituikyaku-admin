import { useEffect, useRef, useState } from 'react';
import { Box, Fab, Badge, Dialog, DialogTitle, DialogContent, TextField, IconButton, Typography, Paper, CircularProgress } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import { sellerPortalApi } from '../../services/sellerPortalApi';

// このFABは「その他のご相談」（一般的な質問）専用。査定額・査定根拠・手残り・スケジューについての
// 相談は各カード内のインライン展開チャット（InlineChatSection.tsx）で行うため、
// ここでは contextTag は常に 'general' 固定として扱われる。
const CONTEXT_LABELS: Record<string, string> = {
  general: 'その他のご相談',
  valuation: '査定額についての相談',
  valuation_breakdown: '査定の理由についての相談',
  net_proceeds: '手残りについての相談',
  schedule: '売却スケジュールについての相談',
};

interface Message {
  id: string;
  sender_type: 'seller' | 'staff';
  content: string;
  created_at: string;
}

/**
 * 「スタッフに相談する」チャットウィジェット。AIではなく実際のスタッフが返信する。
 * スマホでは常時アクセスしやすいFABボタンとして固定表示する。
 */
export default function ChatWidget({
  token,
  open,
  contextTag,
  unreadCount,
  onOpen,
  onClose,
  onMessagesRead,
}: {
  token: string;
  open: boolean;
  contextTag: string;
  /** 未読件数（FABの赤バッジ表示用）。ページ側で一括管理し、各カードの赤丸表示と同じデータを共有する */
  unreadCount: number;
  onOpen: () => void;
  onClose: () => void;
  /** 開いたことで既読になったタイミングで呼ばれる。ページ側の未読状態（FAB・各カードの赤丸）を再取得させる */
  onMessagesRead?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, token, contextTag, onMessagesRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <>
      <Badge
        color="error"
        badgeContent={unreadCount}
        overlap="circular"
        sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 50 }}
      >
        <Fab color="primary" onClick={onOpen} aria-label="スタッフに相談する">
          <ChatIcon />
        </Fab>
      </Badge>

      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { height: '80vh' } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              スタッフに相談
            </Typography>
            <Typography variant="caption" color="text.secondary">
              くじら不動産のスタッフが返信します（{CONTEXT_LABELS[contextTag] ?? contextTag}）
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 0 }}>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!loading && messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                ご質問があれば、こちらからスタッフにメッセージを送ってください。
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
                    maxWidth: '75%',
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
          <Box sx={{ p: 1.5, borderTop: '1px solid #eee', display: 'flex', gap: 1 }}>
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
              <SendIcon />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
