import React, { useState } from 'react';
import { Chip } from '@mui/material';
import { keyframes } from '@mui/system';

interface DuplicateIndicatorBadgeProps {
  duplicateCount: number;
  onClick: () => void;
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
}) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onClick();
  };

  return (
    <Chip
      label={`重複 (${duplicateCount})`}
      color="warning"
      onClick={handleClick}
      sx={{
        ml: 1,
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.9rem',
        height: '34px',
        px: 0.5,
        // クリック前はアニメーション、クリック後は停止
        animation: clicked ? 'none' : `${pulse} 1.4s ease-in-out infinite`,
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
