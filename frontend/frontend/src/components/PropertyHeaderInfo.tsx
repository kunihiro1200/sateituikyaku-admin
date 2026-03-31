import { Box, Typography, Paper, IconButton, Tooltip, Button, ButtonGroup, Snackbar, Alert } from '@mui/material';
import { ContentCopy as ContentCopyIcon, Check as CheckIcon } from '@mui/icons-material';
import { useState } from 'react';
import api from '../services/api';

interface PropertyHeaderInfoProps {
  address: string | null;
  salesPrice: number | null;
  salesAssignee: string | null;
  propertyNumber: string;
  confirmation?: '未' | '済';
  onConfirmationUpdate?: (confirmation: '未' | '済') => void;
}

/**
 * 物件ヘッダー情報コンポーネント
 * 
 * レインズ登録ページのヘッダーに物件の基本情報を表示します。
 * - 物件所在地
 * - 売買価格（万円単位、カンマ区切り）
 * - 営業担当
 * 
 * 空欄時のフォールバック表示：
 * - 物件所在地が空欄 → 「未入力」
 * - 売買価格が空欄 → 「価格応談」
 * - 営業担当が空欄 → 「未設定」
 */
export default function PropertyHeaderInfo({
  address,
  salesPrice,
  salesAssignee,
  propertyNumber,
  confirmation = '未',
  onConfirmationUpdate,
}: PropertyHeaderInfoProps) {
  const [copied, setCopied] = useState(false);
  const [confirmationUpdating, setConfirmationUpdating] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 物件番号をクリップボードにコピー
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(propertyNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // キーボード操作でコピー
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCopy();
    }
  };

  // 確認フィールド更新
  const handleUpdateConfirmation = async (value: '未' | '済') => {
    setConfirmationUpdating(true);
    try {
      await api.put(`/api/property-listings/${propertyNumber}/confirmation`, { confirmation: value });
      if (onConfirmationUpdate) {
        onConfirmationUpdate(value);
      }
      setSnackbar({ open: true, message: `確認を「${value}」に更新しました`, severity: 'success' });
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || '確認の更新に失敗しました', 
        severity: 'error' 
      });
    } finally {
      setConfirmationUpdating(false);
    }
  };

  // 事務へCHAT送信
  const handleSendChatToOffice = async () => {
    try {
      await api.post(`/api/property-listings/${propertyNumber}/send-chat-to-office`, {
        message: '',
        senderName: '担当者',
      });
      // 確認フィールドを「未」に自動設定
      if (onConfirmationUpdate) {
        onConfirmationUpdate('未');
      }
      setSnackbar({ open: true, message: '事務へチャットを送信しました', severity: 'success' });
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'チャット送信に失敗しました', 
        severity: 'error' 
      });
    }
  };
  // 売買価格を万円単位でカンマ区切りにフォーマット
  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) {
      return '価格応談';
    }
    // 円単位から万円単位に変換してカンマ区切り
    const manYen = Math.round(price / 10000);
    return `${manYen.toLocaleString()}万円`;
  };

  return (
    <>
      <Paper
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: '#f5f5f5',
          border: '1px solid #e0e0e0',
        }}
      >
        {/* ヘッダー：物件概要 + 物件番号（コピー機能付き） */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 1.5, gap: 2 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            fontWeight="bold"
          >
            物件概要
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography 
              variant="h6" 
              fontWeight="bold" 
              color="primary.main"
              sx={{ fontSize: '1.25rem' }}
            >
              {propertyNumber}
            </Typography>
            <Tooltip title={copied ? 'コピーしました' : '物件番号をコピー'}>
              <IconButton
                size="medium"
                onClick={handleCopy}
                onKeyDown={handleKeyDown}
                aria-label="物件番号をコピー"
                sx={{ 
                  color: copied ? 'success.main' : 'primary.main',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                {copied ? <CheckIcon /> : <ContentCopyIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.5, sm: 3 },
            flexWrap: 'wrap',
          }}
        >
          {/* 物件所在地 */}
          <Box sx={{ flex: { xs: '1 1 100%', sm: '2 1 200px' } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
              sx={{ display: 'block', mb: 0.5 }}
            >
              物件所在地
            </Typography>
            <Typography variant="body2" color={address ? 'text.primary' : 'text.disabled'}>
              {address || '未入力'}
            </Typography>
          </Box>

          {/* 売買価格 */}
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 120px' } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
              sx={{ display: 'block', mb: 0.5 }}
            >
              売買価格
            </Typography>
            <Typography
              variant="body2"
              color={salesPrice ? 'text.primary' : 'text.disabled'}
              fontWeight={salesPrice ? 'bold' : 'normal'}
            >
              {formatPrice(salesPrice)}
            </Typography>
          </Box>

          {/* 営業担当 */}
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 100px' } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight="bold"
              sx={{ display: 'block', mb: 0.5 }}
            >
              営業担当
            </Typography>
            <Typography variant="body2" color={salesAssignee ? 'text.primary' : 'text.disabled'}>
              {salesAssignee || '未設定'}
            </Typography>
          </Box>
        </Box>

        {/* ヘッダーボタン（2行レイアウト） */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          {/* 第1行: 売主TEL、EMAIL送信、SMS、公開URL */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small">売主TEL</Button>
            <Button variant="outlined" size="small">EMAIL送信</Button>
            <Button variant="outlined" size="small">SMS</Button>
            <Button variant="outlined" size="small">公開URL</Button>
          </Box>
          
          {/* 第2行: 担当へCHAT、事務へCHAT */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" size="small">担当へCHAT</Button>
            <Button 
              variant="contained" 
              size="small"
              onClick={handleSendChatToOffice}
              aria-label="事務担当者へチャットを送信"
            >
              事務へCHAT
            </Button>
          </Box>
        </Box>

        {/* 確認フィールドトグル */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2 }}>
          <Typography variant="body2" fontWeight="bold">確認:</Typography>
          <ButtonGroup size="small" disabled={confirmationUpdating}>
            <Button
              variant={confirmation === '未' ? 'contained' : 'outlined'}
              onClick={() => handleUpdateConfirmation('未')}
              aria-label="確認を未に設定"
              aria-pressed={confirmation === '未'}
            >
              未
            </Button>
            <Button
              variant={confirmation === '済' ? 'contained' : 'outlined'}
              onClick={() => handleUpdateConfirmation('済')}
              aria-label="確認を済に設定"
              aria-pressed={confirmation === '済'}
            >
              済
            </Button>
          </ButtonGroup>
          {/* スクリーンリーダー用のaria-live領域 */}
          <Box
            role="status"
            aria-live="polite"
            aria-atomic="true"
            sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
          >
            {confirmationUpdating && `確認を${confirmation}に更新中`}
          </Box>
        </Box>

        {/* スクリーンリーダー用のaria-live領域（コピー通知） */}
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
        >
          {copied && '物件番号をコピーしました'}
        </Box>
      </Paper>

      {/* 成功・エラー通知 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
