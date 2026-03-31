import { Box, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { ContentCopy as ContentCopyIcon, Check as CheckIcon } from '@mui/icons-material';
import { useState } from 'react';

interface PropertyHeaderInfoProps {
  address: string | null;
  salesPrice: number | null;
  salesAssignee: string | null;
  propertyNumber: string;
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
}: PropertyHeaderInfoProps) {
  const [copied, setCopied] = useState(false);

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

      {/* スクリーンリーダー用のaria-live領域 */}
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
  );
}
