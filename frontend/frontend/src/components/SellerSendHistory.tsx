import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import { propertyListingApi } from '../services/api';
import SellerSendHistoryDetailModal, { SellerSendHistoryItem } from './SellerSendHistoryDetailModal';

// 売主への送信種別（フィルタリング対象）
const SELLER_CHAT_TYPES = ['seller_email', 'seller_sms', 'seller_gmail'];

// 送信種別ラベルの定義
const CHAT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  seller_email: { label: 'EMAIL', color: '#1565c0' },
  seller_sms: { label: 'SMS', color: '#2e7d32' },
  seller_gmail: { label: 'GMAIL', color: '#c62828' },
};

interface SellerSendHistoryProps {
  propertyNumber: string;
  refreshTrigger?: number;
}

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

const SellerSendHistory: React.FC<SellerSendHistoryProps> = ({
  propertyNumber,
  refreshTrigger = 0,
}) => {
  const [history, setHistory] = useState<SellerSendHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 詳細モーダルの状態
  const [selectedItem, setSelectedItem] = useState<SellerSendHistoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 送信履歴を取得してseller系のみフィルタリング
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await propertyListingApi.getChatHistory(propertyNumber, {
        limit: 50,
      });

      // seller_email / seller_sms / seller_gmail のみ抽出
      const filtered = (response.history || []).filter(
        (item: SellerSendHistoryItem) => SELLER_CHAT_TYPES.includes(item.chat_type)
      );

      setHistory(filtered);
    } catch (err: any) {
      console.error('[SellerSendHistory] 送信履歴の取得に失敗しました:', err);
      setError('送信履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // propertyNumber または refreshTrigger が変わったら再取得
  useEffect(() => {
    fetchHistory();
  }, [propertyNumber, refreshTrigger]);

  // アイテムクリック時にモーダルを開く
  const handleItemClick = (item: SellerSendHistoryItem) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  // モーダルを閉じる
  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        売主への送信履歴
      </Typography>

      {history.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          送信履歴はありません
        </Typography>
      ) : (
        <Box
          sx={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: 1,
          }}
        >
          {history.map((item, index) => {
            const typeInfo = CHAT_TYPE_LABELS[item.chat_type] || {
              label: item.chat_type,
              color: '#666',
            };

            return (
              <React.Fragment key={item.id}>
                <Paper
                  elevation={0}
                  onClick={() => handleItemClick(item)}
                  sx={{
                    p: 1.5,
                    backgroundColor: index % 2 === 0 ? '#fafafa' : '#ffffff',
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: '#f0f4ff',
                    },
                  }}
                >
                  {/* 送信種別ラベル + 送信日時 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        px: 0.75,
                        py: 0.1,
                        borderRadius: 0.5,
                        backgroundColor: typeInfo.color,
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        lineHeight: 1.5,
                      }}
                    >
                      {typeInfo.label}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(item.sent_at)}
                    </Typography>
                  </Box>

                  {/* 件名（SMSの場合は空文字のため非表示） */}
                  {item.subject && (
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 'medium', mb: 0.25 }}
                      noWrap
                    >
                      {item.subject}
                    </Typography>
                  )}

                  {/* 送信者名 */}
                  <Typography variant="caption" color="text.secondary">
                    {item.sender_name}
                  </Typography>
                </Paper>
                {index < history.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </Box>
      )}

      {/* 詳細モーダル */}
      <SellerSendHistoryDetailModal
        open={modalOpen}
        item={selectedItem}
        onClose={handleModalClose}
      />
    </Box>
  );
};

export default SellerSendHistory;
