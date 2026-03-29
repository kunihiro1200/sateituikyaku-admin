import React from 'react';
import { Box, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// グローバルCSSアニメーションを一度だけ注入する
const STYLE_ID = 'purchase-badge-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes purchasePulse {
      0%   { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.9); }
      50%  { box-shadow: 0 0 14px 8px rgba(211, 47, 47, 0.4); }
      100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
    }
  `;
  document.head.appendChild(style);
}

interface PurchaseStatusBadgeProps {
  statusText: string | null;
}

export const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({ statusText }) => {
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
        animation: 'purchasePulse 1.5s ease-in-out infinite',
      }}
    >
      <WarningAmberIcon sx={{ fontSize: '1.1rem', color: 'white' }} />
      <Typography sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
        {statusText}
      </Typography>
    </Box>
  );
};

export default PurchaseStatusBadge;
