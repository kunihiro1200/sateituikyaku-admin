import React from 'react';
import DOMPurify from 'dompurify';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
} from '@mui/material';

// 売主への送信履歴アイテムの型定義
export interface SellerSendHistoryItem {
  id: string;
  property_number: string;
  chat_type: 'seller_email' | 'seller_sms' | 'seller_gmail';
  subject: string;
  message: string;
  sender_name: string;
  sent_at: string;
}

interface SellerSendHistoryDetailModalProps {
  open: boolean;
  item: SellerSendHistoryItem | null;
  onClose: () => void;
}

// 送信種別ラベルの定義
const CHAT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  seller_email: { label: 'EMAIL', color: '#1565c0' },
  seller_sms: { label: 'SMS', color: '#2e7d32' },
  seller_gmail: { label: 'GMAIL', color: '#c62828' },
};

// 日時フォーマット（YYYY/MM/DD HH:mm）
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

// <br> タグのみ許可し、その他の危険なタグはサニタイズする
const sanitizeMessage = (message: string): string => {
  return DOMPurify.sanitize(message, {
    ALLOWED_TAGS: ['br'],
    ALLOWED_ATTR: [],
  });
};

const SellerSendHistoryDetailModal: React.FC<SellerSendHistoryDetailModalProps> = ({
  open,
  item,
  onClose,
}) => {
  if (!item) return null;

  const typeInfo = CHAT_TYPE_LABELS[item.chat_type] || { label: item.chat_type, color: '#666' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {/* 送信種別ラベル */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              backgroundColor: typeInfo.color,
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }}
          >
            {typeInfo.label}
          </Box>
          <Typography variant="h6" component="span">
            送信履歴詳細
          </Typography>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent>
        {/* 件名（SMSの場合は空文字のため非表示） */}
        {item.subject && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              件名
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>
              {item.subject}
            </Typography>
          </Box>
        )}

        {/* 送信者名 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            送信者
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            {item.sender_name}
          </Typography>
        </Box>

        {/* 送信日時 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            送信日時
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }}>
            {formatDateTime(item.sent_at)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 本文全文 */}
        <Box>
          <Typography variant="caption" color="text.secondary">
            本文
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              wordBreak: 'break-word',
              backgroundColor: '#f5f5f5',
              p: 1.5,
              borderRadius: 1,
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeMessage(item.message) }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SellerSendHistoryDetailModal;
