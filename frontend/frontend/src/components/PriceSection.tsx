import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, IconButton as MuiIconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import api from '../services/api';

// 月々ローン支払い計算（元利均等返済、金利年3%/12、420回）
function calcMonthlyPayment(price: number): number {
  const r = 0.0007916666667;
  const n = 420;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

// 半角数字を全角数字に変換
function toFullWidth(num: number): string {
  return num.toLocaleString().replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
}

interface PriceSectionProps {
  salesPrice?: number;
  salesPriceActual?: number;
  listingPrice?: number;
  propertyType?: string;
  priceReductionHistory?: string;
  priceReductionScheduledDate?: string | null;
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
  salesPriceActual,
  listingPrice,
  propertyType,
  priceReductionHistory,
  priceReductionScheduledDate,
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
  const actualPrice = editedData.sales_price !== undefined ? editedData.sales_price : salesPriceActual;
  const showMonthlyPayment = propertyType === '戸建て' || propertyType === 'マンション' || propertyType === '戸' || propertyType === 'マ' || propertyType === '戸建';
  const monthlyPayment = actualPrice ? calcMonthlyPayment(actualPrice) : null;
  const displayPriceReductionHistory = editedData.price_reduction_history !== undefined ? editedData.price_reduction_history : priceReductionHistory;
  const displayScheduledDate = editedData.price_reduction_scheduled_date !== undefined ? editedData.price_reduction_scheduled_date : priceReductionScheduledDate;

  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [copiedMonthly, setCopiedMonthly] = useState(false);

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
    setConfirmDialogOpen(false);
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
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              値下げ予約日
            </Typography>
            <TextField
              fullWidth
              type="date"
              value={displayScheduledDate || ''}
              onChange={(e) => onFieldChange('price_reduction_scheduled_date', e.target.value || null)}
              InputLabelProps={{ shrink: true }}
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
          {showMonthlyPayment && monthlyPayment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                月々ローン支払い
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '1.8rem', color: '#1976d2' }}>
                  ¥{toFullWidth(monthlyPayment)}/月
                </Typography>
                <Tooltip title={copiedMonthly ? 'コピーしました' : '数字をコピー'}>
                  <MuiIconButton
                    size="small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(monthlyPayment));
                        setCopiedMonthly(true);
                        setTimeout(() => setCopiedMonthly(false), 2000);
                      } catch {}
                    }}
                    sx={{ color: copiedMonthly ? 'success.main' : '#1976d2' }}
                  >
                    {copiedMonthly ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                  </MuiIconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary">
                ※金利3%・35年・元利均等返済
              </Typography>
            </Box>
          )}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              値下げ履歴
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', fontSize: '1.1rem' }}>
              {displayPriceReductionHistory || '-'}
            </Typography>
          </Box>
          {displayScheduledDate && (
            <Box>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                値下げ予約日
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.1rem', color: new Date(displayScheduledDate) <= new Date() ? '#d32f2f' : 'inherit', fontWeight: new Date(displayScheduledDate) <= new Date() ? 'bold' : 'normal' }}>
                {displayScheduledDate}
              </Typography>
            </Box>
          )}

          {/* Chat送信ボタン */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                if (getLatestPriceReduction()) setConfirmDialogOpen(true);
                else onChatSendError('値下げ履歴が見つかりません');
              }}
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

      {/* 送信確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chat送信の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            以下の内容をGoogle Chatに送信します：
          </Typography>
          <Box sx={{ mt: 1, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.9rem' }}>
            {`【値下げ通知】\n${getLatestPriceReduction() || ''}\n${address || ''}\n${window.location.origin}/property-listings/${propertyNumber}`}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendPriceReductionChat}
            disabled={sendingChat}
            sx={{ backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}
          >
            {sendingChat ? '送信中...' : '送信する'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
