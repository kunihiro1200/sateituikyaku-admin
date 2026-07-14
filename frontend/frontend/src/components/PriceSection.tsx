import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, TextField, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, IconButton as MuiIconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import api from '../services/api';
import ImageSelectorModal from './ImageSelectorModal';
import { PropertyChatSendData } from '../types/chat';
import { supabase } from '../config/supabase';

// 月々ローン支払い計算（元利均等返済、金利年1.3%/12、420回）
function calcMonthlyPayment(price: number): number {
  const r = 0.00108333333; // 月利 = 1.3% / 12
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
  const [chatSource, setChatSource] = useState<'blue' | 'orange'>('blue'); // どちらのバーから開いたか
  const [imageSelectorOpen, setImageSelectorOpen] = useState(false);
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]); // 複数画像対応
  const [uploadingCount, setUploadingCount] = useState(0);
  const uploadingImage = uploadingCount > 0;
  const [chatMessageBody, setChatMessageBody] = useState('');
  const [copiedMonthly, setCopiedMonthly] = useState(false);

  // ファイルをSupabase Storageにアップロードして公開URLを取得（Google Chat表示用）
  const uploadImageToStorage = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '.png';
    const safeName = file.name
      .slice(0, file.name.length - ext.length)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '') || 'image';
    const filePath = `chat-images/${timestamp}_${safeName}${ext}`;

    const { error } = await supabase.storage
      .from('shared-items')
      .upload(filePath, file, { contentType: file.type, upsert: false });

    if (error) throw new Error(`画像アップロード失敗: ${error.message}`);

    const { data } = supabase.storage.from('shared-items').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // ファイル選択ハンドラ（複数対応・useCallbackで最新状態を参照）
  const handleLocalFileSelect = useCallback(async (file: File) => {
    setUploadingCount(prev => prev + 1);
    try {
      const url = await uploadImageToStorage(file);
      setSelectedImageUrls(prev => [...prev, url]); // 配列に追加
    } catch (err) {
      console.error('画像アップロードエラー:', err);
      onChatSendError('画像のアップロードに失敗しました');
    } finally {
      setUploadingCount(prev => prev - 1);
    }
  }, [propertyNumber, onChatSendError]);

  // handleLocalFileSelectの最新版をrefで保持（useEffect内クロージャ問題を回避）
  const handleLocalFileSelectRef = useRef(handleLocalFileSelect);
  useEffect(() => {
    handleLocalFileSelectRef.current = handleLocalFileSelect;
  }, [handleLocalFileSelect]);

  // クリップボード貼り付けハンドラ（refで最新のhandleLocalFileSelectを参照）
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
            await handleLocalFileSelectRef.current(file); // refで最新関数を参照
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
      // 複数画像のURLを改行で連結
      const imageUrlLines = selectedImageUrls.length > 0 
        ? '\n' + selectedImageUrls.map(url => `📷 ${url}`).join('\n')
        : '';
      
      const GOOGLE_CHAT_LIMIT = 4096;
      const TRUNCATE_SUFFIX = '...';
      const SAFE_LIMIT = GOOGLE_CHAT_LIMIT - TRUNCATE_SUFFIX.length; // 4093

      const fullText = `${chatMessageBody}${imageUrlLines}`;
      const truncatedText = fullText.length > GOOGLE_CHAT_LIMIT
        ? fullText.substring(0, SAFE_LIMIT) + TRUNCATE_SUFFIX
        : fullText;

      // バックエンドのAPIを使用して物件担当へ送信
      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-assignee`, {
        message: truncatedText,
        senderName: '物件リスト詳細画面',
      });

      // 青いバーから送信した場合は確認=「未」にする（onChatSendSuccessを呼ぶ）
      // オレンジバーから送信した場合は確認を変えない（onPriceReductionChatSendSuccessを呼ぶ）
      if (chatSource === 'blue') {
        onChatSendSuccess('値下げ通知を送信しました');
      } else {
        (onPriceReductionChatSendSuccess ?? onChatSendSuccess)('値下げ通知を送信しました');
      }
      setChatSent(true);  // オレンジのバーを非表示にする
      setSelectedImageUrls([]); // 画像リストをクリア
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
                ※金利1.3%・35年・元利均等返済
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
                    setChatSource('orange');
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
                    setChatSource('blue');
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
      <Dialog open={confirmDialogOpen} onClose={() => { setConfirmDialogOpen(false); setSelectedImageUrls([]); setChatMessageBody(''); }} maxWidth="sm" fullWidth>
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
          {/* 画像添付セクション（複数対応） */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              画像添付（任意・複数可）：
            </Typography>
            {uploadingImage && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>アップロード中...</Typography>
            )}
            {/* 添付済み画像一覧 */}
            {selectedImageUrls.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 1 }}>
                {selectedImageUrls.map((url, index) => (
                  <Box key={index} sx={{ position: 'relative', width: 80, height: 60 }}>
                    <Box
                      component="img"
                      src={url.startsWith('http') ? url : undefined}
                      alt={`添付画像${index + 1}`}
                      sx={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover', 
                        borderRadius: 1, 
                        border: '1px solid #ddd',
                        display: url.startsWith('http') ? 'block' : 'none'
                      }}
                    />
                    {!url.startsWith('http') && (
                      <Typography variant="caption" color="text.secondary">画像{index + 1}</Typography>
                    )}
                    <Button 
                      size="small" 
                      color="error" 
                      onClick={() => setSelectedImageUrls(prev => prev.filter((_, i) => i !== index))}
                      sx={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8, 
                        minWidth: 24, 
                        width: 24, 
                        height: 24, 
                        p: 0,
                        backgroundColor: 'white',
                        '&:hover': { backgroundColor: '#ffebee' }
                      }}
                    >
                      ×
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
            {/* 画像追加ボタン */}
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {/* ローカルファイル選択（複数選択可能） */}
              <Button
                size="small"
                variant="outlined"
                component="label"
                disabled={uploadingImage}
              >
                📁 ファイルを選択
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    for (const file of files) {
                      await handleLocalFileSelect(file);
                    }
                    e.target.value = '';
                  }}
                />
              </Button>
              {/* Google Drive選択 */}
              <Button
                size="small"
                variant="outlined"
                onClick={() => setImageSelectorOpen(true)}
                disabled={uploadingImage}
              >
                ☁️ Driveから選択
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                またはここにスクショを貼り付け（Ctrl+V）
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDialogOpen(false); setSelectedImageUrls([]); setChatMessageBody(''); }}>キャンセル</Button>
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

      {/* 画像選択モーダル（複数選択対応） */}
      <ImageSelectorModal
        open={imageSelectorOpen}
        onClose={() => setImageSelectorOpen(false)}
        onConfirm={async (images) => {
          // 複数画像を処理
          for (const img of images) {
            if (img.source === 'local' && img.localFile) {
              // ローカルファイル: Driveにアップロード
              await handleLocalFileSelect(img.localFile);
            } else {
              // Google Drive画像またはURL: そのまま使用
              const imgUrl = img.url || img.previewUrl || '';
              if (imgUrl) {
                setSelectedImageUrls(prev => [...prev, imgUrl]);
              }
            }
          }
          setImageSelectorOpen(false);
        }}
        sellerNumber={propertyNumber}
      />
    </Box>
  );
}
