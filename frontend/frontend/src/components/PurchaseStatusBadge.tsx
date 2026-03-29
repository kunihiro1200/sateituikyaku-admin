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
        bgcolor: 'error.light',   // 赤背景
        color: 'error.main',      // 赤文字
        px: 2,
        py: 0.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'error.main',
      }}
    >
      {/* 警告アイコンで視覚的強調 */}
      <WarningAmberIcon sx={{ fontSize: '1.1rem' }} />
      <Typography
        sx={{
          fontWeight: 'bold',     // 太字
          fontSize: '1.1rem',     // フォントサイズ
          color: 'error.main',    // 赤文字
        }}
      >
        {statusText}
      </Typography>
    </Box>
  );
};

export default PurchaseStatusBadge;
