import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, Container, Paper, Chip, CircularProgress, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import api from '../services/api';

interface ConsultHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  theme_tag: string | null;
  answer_source: string | null;
  created_at: string;
  conversation_id: string;
}

/**
 * 社内向け：特定の売主の相談アプリ利用履歴を表示するページ（認証必須）。
 * CallModePageの「資料生成」メニュー「相談アプリ履歴」から新しいタブで開かれる。
 */
export default function ConsultHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [sellerNumber, setSellerNumber] = useState<string | null>(null);
  const [history, setHistory] = useState<ConsultHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        // 売主番号を取得してから履歴APIを呼ぶ（履歴APIはseller_number単位のため）
        const sellerRes = await api.get(`/api/sellers/${id}`);
        const number = sellerRes.data?.sellerNumber || sellerRes.data?.seller_number;
        setSellerNumber(number);

        if (number) {
          const res = await api.get(`/api/consult/admin/history/${number}`);
          setHistory(res.data.history || []);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || '取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => {
            if (window.opener) window.close();
            else window.history.back();
          }}
          variant="outlined"
          size="small"
        >
          戻る
        </Button>
        <Typography variant="h6" fontWeight="bold">
          相談アプリ履歴
          {sellerNumber && (
            <Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 1 }}>
              （{sellerNumber}）
            </Typography>
          )}
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && history.length === 0 && (
        <Typography color="text.secondary">この売主の相談履歴はまだありません。</Typography>
      )}

      {history.map((m) => (
        <Paper
          key={m.id}
          sx={{
            p: 1.5,
            mb: 1,
            bgcolor: m.role === 'user' ? '#e3f2fd' : '#fafafa',
          }}
          variant="outlined"
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {m.role === 'user' ? '売主' : 'AI'} ・ {new Date(m.created_at).toLocaleString('ja-JP')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {m.theme_tag && <Chip label={m.theme_tag} size="small" />}
              {m.answer_source === 'unanswered' && <Chip label="未回答" size="small" color="warning" />}
            </Box>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {m.content}
          </Typography>
        </Paper>
      ))}
    </Container>
  );
}
