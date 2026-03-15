import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Grid, Button, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import api from '../services/api';

interface PriceSectionProps {
  salesPrice?: number;
  listingPrice?: number;
  priceReductionHistory?: string;
  onFieldChange: (field: string, value: any) => void;
  editedData: Record<string, any>;
  isEditMode: boolean;
  propertyNumber: string;
  salesAssignee?: string;
  address?: string;
  onChatSendSuccess: (message: string) => void;
  onChatSendError: (message: string) => void;
}

export default function PriceSection({
  salesPrice,
  listingPrice,
  priceReductionHistory,
  onFieldChange,
  editedData,
  isEditMode,
  propertyNumber,
  salesAssignee,
  address,
  onChatSendSuccess,
  onChatSendError,
}: PriceSectionProps) {
  const displaySalesPrice = editedData.sales_price !== undefined ? editedData.sales_price : salesPrice;
  const displayListingPrice = editedData.listing_price !== undefined ? editedData.listing_price : listingPrice;
  const displayPriceReductionHistory = editedData.price_reduction_history !== undefined ? editedData.price_reduction_history : priceReductionHistory;

  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);

  // 値下げ履歴の最新行を検出
  const getLatestPriceReduction = () => {
    if (!displayPriceReductionHistory) return null;
    const lines = displayPriceReductionHistory.split('\n').filter((line: string) => line.trim());
    return lines.length > 0 ? lines[0] : null;
  };

  // 売買価格が変更されたかチェック
  const isPriceChanged = editedData.sales_price !== undefined && editedData.sales_price !== salesPrice;

  // 予約通知を取得
  useEffect(() => {
    const fetchScheduledNotifications = async () => {
      if (!propertyNumber) return;
      setLoadingNotifications(true);
      try {
        const response = await api.get(`/api/property-listings/${propertyNumber}/scheduled-notifications`);
        setScheduledNotifications(response.data || []);
      } catch (error) {
        console.error('Failed to fetch scheduled notifications:', error);
        setScheduledNotifications([]);
      } finally {
        setLoadingNotifications(false);
      }
    };
    fetchScheduledNotifications();
  }, [propertyNumber]);

  const handleSendPriceReductionChat = async () => {
    const latestReduction = getLatestPriceReduction();
    if (!latestReduction) {
      onChatSendError('値下げ履歴が見つかりません');
      return;
    }

    setSendingChat(true);
    try {
      const webhookUrl = 'https://chat.googleapis.com/v1/spaces/AAAAw9wyS-o/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=t6SJmZ8af-yyB38DZzAqGOKYI-DnIl6wYtVo-Lyskuk';
      const propertyUrl = `${window.location.origin}/property-listings/${propertyNumber}`;

      const message = {
        text: `【値下げ通知】\n${latestReduction}\n${address || ''}\n${propertyUrl}`
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error('Failed to send message to Google Chat');
      }

      onChatSendSuccess('値下げ通知を送信しました');
    } catch (error: any) {
      console.error('Failed to send price reduction chat:', error);
      onChatSendError('値下げ通知の送信に失敗しました');
    } finally {
      setSendingChat(false);
    }
  };

  const formatPrice = (price?: number | null) => {
    if (price === null || price === undefined) return '-';
    return `¥${price.toLocaleString()}`;
  };

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1 }}>
      {isEditMode ? (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売買価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displaySalesPrice || ''}
              onChange={(e) => onFieldChange('sales_price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'primary.main',
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売出価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displayListingPrice || ''}
              onChange={(e) => onFieldChange('listing_price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '20px',
                  fontWeight: 'medium',
                },
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              値下げ履歴
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={displayPriceReductionHistory || ''}
              onChange={(e) => onFieldChange('price_reduction_history', e.target.value)}
              placeholder="値下げ履歴を入力してください"
              sx={{ whiteSpace: 'pre-line' }}
            />
          </Grid>
        </Grid>
      ) : (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              売買価格
            </Typography>
            <Typography variant="h3" fontWeight="bold" color="primary.main" sx={{ fontSize: '2.5rem' }}>
              {formatPrice(displaySalesPrice)}
            </Typography>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              売出価格
            </Typography>
            <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '2rem' }}>
              {formatPrice(displayListingPrice)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              値下げ履歴
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', fontSize: '1.1rem' }}>
              {displayPriceReductionHistory || '-'}
            </Typography>
          </Box>

          {/* Chat送信ボタン */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSendPriceReductionChat}
              disabled={sendingChat || !getLatestPriceReduction()}
              sx={{
                backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#d32f2f' : '#1976d2',
                '&:hover': {
                  backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#b71c1c' : '#1565c0',
                },
                fontSize: '1.1rem',
                fontWeight: 'bold',
                animation: isPriceChanged && scheduledNotifications.length === 0 ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                  '70%': { boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                },
              }}
            >
              {sendingChat ? '送信中...' : 'Chat送信'}
            </Button>
            {!getLatestPriceReduction() && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                値下げ履歴が見つかりません
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
