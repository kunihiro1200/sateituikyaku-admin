import React from 'react';
import { Box, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/**
 * 買付状況バッジコンポーネントの props
 */
interface PurchaseStatusBadgeProps {
  /** 買付状況テキスト（null または空文字の場合は何も表示しない） */
  statusText: string | null;
}

/**
 * 買付状況バッジコンポーネント
 *
 * 買付状況テキストを赤背景・赤文字・太字で目立つように表示する。
 * statusText が null または空文字の場合は何も描画しない。
 */
export const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({ statusText }) => {
  // null または空文字の場合は何も表示しない
  if (!statusText) return null;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'error.main',
        color: 'white',
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        // パルスアニメーション（光る）
        animation: 'purchasePulse 1.5s ease-in-out infinite',
        '@keyframes purchasePulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.8)' },
          '50%':  { boxShadow: '0 0 12px 6px rgba(211, 47, 47, 0.4)' },
          '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
        },
      }}
    >
      {/* 警告アイコンで視覚的強調 */}
      <WarningAmberIcon sx={{ fontSize: '1.1rem', color: 'white' }} />
      <Typography
        sx={{
          fontWeight: 'bold',
          fontSize: '1rem',
          color: 'white',
        }}
      >
        {statusText}
      </Typography>
    </Box>
  );
};

export default PurchaseStatusBadge;
