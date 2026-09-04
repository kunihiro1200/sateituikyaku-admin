import { useEffect, useState } from 'react';
import { Box, Button, Typography, Grid, Chip, TextField, IconButton, CircularProgress, Alert, Divider, Paper } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import api from '../services/api';

/**
 * 売却サポートページ（査定依頼者向け専用ページ）のスタッフ管理セクション。
 * SellerDetailPage.tsx の既存 CollapsibleSection パターンに合わせて使う想定。
 *
 * 表示内容：
 * - 専用URL発行状況・最終アクセス日時・アクセス回数
 * - ユーザーが入力した希望価格・希望売却時期
 * - チャット未読件数、返信欄
 */
export default function SellerPortalAdminSection({ sellerId, sellerNumber }: { sellerId: string; sellerNumber: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingConvId, setSendingConvId] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/seller-portal/admin/${sellerId}/status`);
      setStatus(res.data);
      const msgRes = await api.get(`/api/seller-portal/admin/${sellerId}/messages`);
      setConversations(msgRes.data.conversations || []);
    } catch {
      // 未発行の場合もあるため、エラーは静かに無視する（statusはnullのまま）
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  const handleIssueToken = async () => {
    setIssuing(true);
    try {
      const res = await api.post(`/api/seller-portal/admin/${sellerId}/issue-token`, { sellerNumber });
      const url = `${window.location.origin}/portal/${res.data.token}`;
      setIssuedUrl(url);
      await loadStatus();
    } finally {
      setIssuing(false);
    }
  };

  const handleCopy = () => {
    if (!issuedUrl) return;
    navigator.clipboard.writeText(issuedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReply = async (conversationId: string) => {
    const content = replyDrafts[conversationId];
    if (!content?.trim()) return;
    setSendingConvId(conversationId);
    try {
      await api.post(`/api/seller-portal/admin/${sellerId}/messages`, {
        conversationId,
        content,
        sellerNumber,
      });
      setReplyDrafts((prev) => ({ ...prev, [conversationId]: '' }));
      await loadStatus();
    } finally {
      setSendingConvId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleIssueToken} disabled={issuing}>
          {issuing ? '発行中...' : status?.tokenStatus ? '専用URLを再発行' : '専用URLを発行'}
        </Button>
        {status?.unreadCount > 0 && (
          <Chip label={`未読 ${status.unreadCount}件`} color="error" size="small" />
        )}
      </Box>

      {issuedUrl && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {issuedUrl}
            </Typography>
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
            {copied && <Typography variant="caption">コピーしました</Typography>}
          </Box>
          <Typography variant="caption" color="text.secondary">
            このURLをSMSまたはメールで売主様にお送りください。再発行すると古いURLは無効になります。
          </Typography>
        </Alert>
      )}

      {status?.tokenStatus && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">発行日時</Typography>
            <Typography variant="body2">{new Date(status.tokenStatus.issued_at).toLocaleString('ja-JP')}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">最終アクセス</Typography>
            <Typography variant="body2">
              {status.tokenStatus.last_accessed_at ? new Date(status.tokenStatus.last_accessed_at).toLocaleString('ja-JP') : '未アクセス'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">アクセス回数</Typography>
            <Typography variant="body2">{status.tokenStatus.access_count}回</Typography>
          </Grid>
        </Grid>
      )}

      {status?.preferences && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">売りたい価格</Typography>
            <Typography variant="body2">
              {status.preferences.desired_sale_price ? `${Math.round(status.preferences.desired_sale_price / 10000).toLocaleString()}万円` : '未入力'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">最低価格</Typography>
            <Typography variant="body2">
              {status.preferences.minimum_sale_price ? `${Math.round(status.preferences.minimum_sale_price / 10000).toLocaleString()}万円` : '未入力'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">売却希望時期</Typography>
            <Typography variant="body2">
              {status.preferences.desired_settlement_year_month
                ? new Date(status.preferences.desired_settlement_year_month).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
                : '未入力'}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">ざっくり手残り閲覧</Typography>
            <Typography variant="body2">{status.preferences.viewed_rough_proceeds_at ? '閲覧済み' : '未閲覧'}</Typography>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Typography variant="caption" color="text.secondary">詳細手残り計算</Typography>
            <Typography variant="body2">{status.preferences.detailed_proceeds_completed ? '実施済み' : '未実施'}</Typography>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
        チャット相談
      </Typography>

      {conversations.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          まだ相談はありません。
        </Typography>
      )}

      {conversations.map((conv) => (
        <Paper key={conv.id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {CONTEXT_LABELS[conv.context_tag] ?? conv.context_tag}
          </Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', my: 1 }}>
            {conv.messages.map((m: any) => (
              <Box key={m.id} sx={{ mb: 0.5, textAlign: m.sender_type === 'seller' ? 'left' : 'right' }}>
                <Typography
                  variant="body2"
                  sx={{
                    display: 'inline-block',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: m.sender_type === 'seller' ? '#f0f4f8' : '#0B2545',
                    color: m.sender_type === 'seller' ? 'text.primary' : 'white',
                  }}
                >
                  {m.content}
                </Typography>
                {!m.read_at && m.sender_type === 'seller' && (
                  <Chip label="未読" size="small" color="error" sx={{ ml: 1, height: 18 }} />
                )}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="返信を入力"
              value={replyDrafts[conv.id] ?? ''}
              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [conv.id]: e.target.value }))}
            />
            <IconButton
              color="primary"
              onClick={() => handleReply(conv.id)}
              disabled={sendingConvId === conv.id || !replyDrafts[conv.id]?.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

const CONTEXT_LABELS: Record<string, string> = {
  general: 'その他のご相談',
  valuation: '査定額についての相談',
  valuation_breakdown: '査定の理由についての相談',
  net_proceeds: '手残りについての相談',
  schedule: '売却スケジュールについての相談',
};
