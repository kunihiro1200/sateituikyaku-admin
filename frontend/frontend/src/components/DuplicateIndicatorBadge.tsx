import React, { useState } from 'react';
import { Chip } from '@mui/material';
import { keyframes } from '@mui/system';

interface DuplicateIndicatorBadgeProps {
  duplicateCount: number;
  onClick: () => void;
  /**
   * 重複による除外確認が済んでいるか。
   * true の場合は光らせず（アニメーション停止）グレー表示にする。
   */
  checked?: boolean;
}

// スケールと影で目立つパルスアニメーション
const pulse = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(237, 108, 2, 0.7);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 8px rgba(237, 108, 2, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(237, 108, 2, 0);
  }
`;

const DuplicateIndicatorBadge: React.FC<DuplicateIndicatorBadgeProps> = ({
  duplicateCount,
  onClick,
  checked = false,
}) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onClick();
  };

  return (
    <Chip
      label={`重複 (${duplicateCount})`}
      // 確認済みはグレー、未確認はオレンジ
      color={checked ? 'default' : 'warning'}
      onClick={handleClick}
      sx={{
        ml: 1,
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.9rem',
        height: '34px',
        px: 0.5,
        // 確認済みはグレー固定
        ...(checked
          ? {
              bgcolor: 'grey.400',
              color: 'grey.900',
            }
          : {}),
        // 確認済み or クリック後はアニメーション停止
        animation: checked || clicked ? 'none' : `${pulse} 1.4s ease-in-out infinite`,
        '& .MuiChip-label': {
          px: 1.5,
        },
        '&:hover': {
          opacity: 0.85,
        },
      }}
    />
  );
};

export default DuplicateIndicatorBadge;
