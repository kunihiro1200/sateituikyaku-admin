import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, IconButton as MuiIconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import api from '../services/api';
import ImageSelectorModal from './ImageSelectorModal';
import { PropertyChatSendData } from '../types/chat';

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
  onPriceReductionChatSendSuccess?: (message: string) => void;
  onChatSendError: (message: string) => void;
  onChatSend: (data: PropertyChatSendData) => Promise<void>;
  priceSavedButNotSent?: boolean;
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
  onPriceReductionChatSendSuccess,
  onChatSendError,
  onChatSend,
  priceSavedButNotSent = false,
}: PriceSectionProps) {
  const displaySalesPrice = editedData.price !== undefined ? editedData.price : salesPrice;
  const displayListingPrice = editedData.listing_price !== undefined ? editedData.listing_price : listingPrice;
  const actualPrice = editedData.price !== undefined ? editedData.price : salesPriceActual;
  const showMonthlyPayment = propertyType === '戸建て' || propertyType === 'マンション' || propertyType === '戸' || propertyType === 'マ' || propertyType === '戸建';
  const monthlyPayment = actualPrice ? calcMonthlyPayment(actualPrice) : null;
  const displayPriceReductionHistory = editedData.price_reduction_history !== undefined ? editedData.price_reduction_history : priceReductionHistory;
  const displayScheduledDate = editedData.price_reduction_scheduled_date !== undefined ? editedData.price_reduction_scheduled_date : priceReductionScheduledDate;

  // ローカル状態変数
  const [chatSent, setChatSent] = useState(false);
  const [scheduledDateWasCleared, setScheduledDateWasCleared] = useState(false);

  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const [copiedMonthly, setCopiedMonthly] = useState(false);

  // ローカルファイル/スクショをDriveにアップロードしてURLを取得
  const uploadImageToDrive = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/api/drive/folders/${propertyNumber}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.file?.webViewLink || res.data?.file?.webContentLink || '';
  };

  // ファイル選択ハンドラ
  const handleLocalFileSelect = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadImageToDrive(file);
      setSelectedImageUrl(url);
    } catch (err) {
      console.error('画像アップロードエラー:', err);
      onChatSendError('画像のアップロードに失敗しました');
    } finally {
      setUploadingImage(false);
    }
  };

  // クリップボード貼り付けハンドラ（ダイアログが開いている間だけグローバルに登録）
  useEffect(() => {
    if (!confirmDialogOpen) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await handleLocalFileSelect(file);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [confirmDialogOpen]);

  // 値下げ履歴の最新行を検出
  const getLatestPriceReduction = () => {
    if (!displayPriceReductionHistory) return null;
    const lines = displayPriceReductionHistory.split('\n').filter((line: string) => line.trim());
    return lines.length > 0 ? lines[0] : null;
  };

  // 売買価格が変更されたかチェック
  const isPriceChanged = editedData.price !== undefined && editedData.price !== salesPrice;

  // displayScheduledDate の変化を監視する
  const prevScheduledDateRef = useRef<string | null | undefined>(displayScheduledDate);

  useEffect(() => {
    const prev = prevScheduledDateRef.current;
    const current = displayScheduledDate;

    // 値があった → 空欄になった場合
    if (prev && !current) {
      setScheduledDateWasCleared(true);
      setChatSent(false);
    }
    // 空欄 → 値が設定された場合（リセット）
    if (!prev && current) {
      setScheduledDateWasCleared(false);
      setChatSent(false);
    }

    prevScheduledDateRef.current = current;
  }, [displayScheduledDate]);

  // オレンジのバー：値下げ予約日をクリアした場合のみ
  const showOrangeChatButton = !isEditMode && !displayScheduledDate && scheduledDateWasCleared && !chatSent;

  // 青いバー：売買価格が変更された場合、または保存済みだがCHATがまだ送信されていない場合
  const showBlueChatButton = !isEditMode && !displayScheduledDate && (isPriceChanged || priceSavedButNotSent) && !showOrangeChatButton;


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

      const GOOGLE_CHAT_LIMIT = 4096;
      const TRUNCATE_SUFFIX = '...';
      const SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length; // 4093

      const imageUrlLine = selectedImageUrl ? `\n📷 ${selectedImageUrl}` : '';
      const fullText = `${chatMessageBody}${imageUrlLine}`;
      const truncatedText = fullText.length > GOOGLE_CHAT_LIMIT
        ? fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX
        : fullText;
      const message = {
        text: truncatedText
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      (onPriceReductionChatSendSuccess ?? onChatSendSuccess)('値下げ通知を送信しました');
      setChatSent(true);  // オレンジのバーを非表示にする
      setSelectedImageUrl(undefined);
      setChatMessageBody('');
    } catch (error: any) {
      console.error('Failed to send price reduction chat:', error);
      const errMsg = error?.message || String(error);
      onChatSendError(`値下げ通知の送信に失敗しました: ${errMsg}`);
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
        <Grid container spacing={0.5}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売買価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displaySalesPrice || ''}
              onChange={(e) => onFieldChange('price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '1rem',
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
              rows={2}
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
          <Box sx={{ mb: 1 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
              売買価格
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="primary.main" sx={{ fontSize: '1.6rem' }}>
              {formatPrice(displaySalesPrice)}
            </Typography>
          </Box>
          {showMonthlyPayment && monthlyPayment && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                月々ローン支払い
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight="medium" sx={{ fontSize: '1.2rem', color: '#1976d2' }}>
                  ¥{toFullWidth(monthlyPayment)}/月
                </Typography>
                <Tooltip title={copiedMonthly ? 'コピーしました' : '数字をコピー'}>
                  <MuiIconButton
                    size="small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(toFullWidth(monthlyPayment));
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
          <Box sx={{ mb: 1 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
              値下げ履歴
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
              {displayPriceReductionHistory || '-'}
            </Typography>
          </Box>
          {displayScheduledDate && (
            <Box>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                値下げ予約日
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: new Date(displayScheduledDate) <= new Date() ? '#d32f2f' : 'inherit', fontWeight: new Date(displayScheduledDate) <= new Date() ? 'bold' : 'normal' }}>
                {displayScheduledDate}
              </Typography>
            </Box>
          )}

          {/* オレンジのバー：値下げ予約日クリア時の通知用 */}
          {showOrangeChatButton && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  const latestReduction = getLatestPriceReduction();
                  if (latestReduction) {
                    const propertyUrl = `${window.location.origin}/property-listings/${propertyNumber}`;
                    const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\n` : '';
                    setChatMessageBody(`${propertyNumberLine}【値下げ通知】\n${latestReduction}\n${address || ''}\n${propertyUrl}`);
                    setConfirmDialogOpen(true);
                  } else {
                    onChatSendError('値下げ履歴が見つかりません');
                  }
                }}
                disabled={sendingChat || !getLatestPriceReduction()}
                sx={{
                  backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#e65100' : '#f57c00',
                  '&:hover': {
                    backgroundColor: isPriceChanged && scheduledNotifications.length === 0 ? '#bf360c' : '#e65100',
                  },
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  animation: isPriceChanged && scheduledNotifications.length === 0 ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.7)' },
                    '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },
                  },
                }}
              >
                {sendingChat ? '送信中...' : '物件担当へCHAT送信（画像添付可能）'}
              </Button>
            </Box>
          )}

          {/* 青いバー：売買価格変更時の通知用（確認フィールドを「未」にリセット） */}
          {showBlueChatButton && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #ddd' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  const latestReduction = getLatestPriceReduction();
                  if (latestReduction) {
                    const propertyUrl = `${window.location.origin}/property-listings/${propertyNumber}`;
                    const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\n` : '';
                    setChatMessageBody(`${propertyNumberLine}【値下げ通知】\n${latestReduction}\n${address || ''}\n${propertyUrl}`);
                    setConfirmDialogOpen(true);
                  } else {
                    onChatSendError('値下げ履歴が見つかりません');
                  }
                }}
                disabled={sendingChat || !getLatestPriceReduction()}
                sx={{
                  backgroundColor: '#1976d2',
                  '&:hover': { backgroundColor: '#1565c0' },
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                {sendingChat ? '送信中...' : 'CHAT送信'}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* 送信確認ダイアログ */}
      <Dialog open={confirmDialogOpen} onClose={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); setChatMessageBody(''); }} maxWidth="sm" fullWidth>
        <DialogTitle>Chat送信の確認</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            以下の内容をGoogle Chatに送信します：
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={chatMessageBody}
            onChange={(e) => setChatMessageBody(e.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.75rem', '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
          />
          {/* 画像添付セクション */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              画像添付（任意）：
            </Typography>
            {uploadingImage ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>アップロード中...</Typography>
            ) : selectedImageUrl ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box
                  component="img"
                  src={selectedImageUrl.startsWith('http') ? selectedImageUrl : undefined}
                  alt="添付画像"
                  sx={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 1, border: '1px solid #ddd', display: selectedImageUrl.startsWith('http') ? 'block' : 'none' }}
                />
                {!selectedImageUrl.startsWith('http') && (
                  <Typography variant="caption" color="text.secondary">画像添付済み</Typography>
                )}
                <Button size="small" color="error" onClick={() => setSelectedImageUrl(undefined)}>
                  削除
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                {/* ローカルファイル選択 */}
                <Button
                  size="small"
                  variant="outlined"
                  component="label"
                >
                  📁 ファイルを選択
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLocalFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                </Button>
                {/* Google Drive選択 */}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setImageSelectorOpen(true)}
                >
                  ☁️ Driveから選択
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  またはここにスクショを貼り付け（Ctrl+V）
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrl(undefined); setChatMessageBody(''); }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleSendPriceReductionChat}
            disabled={sendingChat || uploadingImage}
            sx={{ backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}
          >
            {sendingChat ? '送信中...' : uploadingImage ? '画像アップロード中...' : '送信する'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 画像選択モーダル */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onClose={() => setImageSelectorOpen(false)}
        onConfirm={async (images) => {
          if (images.length > 0) {
            const img = images[0];
            if (img.source === 'local' && img.localFile) {
              // ローカルファイル: Driveにアップロード
              await handleLocalFileSelect(img.localFile);
            } else {
              // Google Drive画像またはURL: そのまま使用
              const imgUrl = img.url || img.previewUrl || '';
              setSelectedImageUrl(imgUrl);
            }
          }
          setImageSelectorOpen(false);
        }}
        sellerNumber={propertyNumber}
      />
    </Box>
  );
}
