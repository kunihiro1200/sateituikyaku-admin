import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { buyerApi } from '../services/api';

export interface ViewingPrepCalendarOkButtonProps {
  buyerNumber: string | null | undefined;
  confirmedAt: string | null | undefined;
  onConfirmedChange?: (confirmedAt: string | null) => void;
}

/**
 * 「カレンダー●OK」ボタン
 * 内覧準備ボタンの左隣に配置し、内覧準備前にカレンダーに●をつけたことを記録する。
 * - 未確認（confirmedAt が空）: アウトライン表示
 * - 確認済み（confirmedAt が入力済み）: グレー塗りつぶし表示
 * - クリックでトグル（確認済み ⇔ 未確認）する
 */
export const ViewingPrepCalendarOkButton: React.FC<ViewingPrepCalendarOkButtonProps> = ({
  buyerNumber,
  confirmedAt,
  onConfirmedChange,
}) => {
  const [saving, setSaving] = useState(false);
  const isConfirmed = !!confirmedAt;

  const handleClick = async () => {
    if (!buyerNumber || saving) return;
    setSaving(true);
    const newValue = isConfirmed ? null : new Date().toISOString();
    try {
      await buyerApi.update(
        buyerNumber,
        { viewing_prep_calendar_confirmed_at: newValue },
        { sync: true, force: true }
      );
      onConfirmedChange?.(newValue);
    } catch (err) {
      console.error('Failed to update viewing_prep_calendar_confirmed_at:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      variant={isConfirmed ? 'contained' : 'outlined'}
      size="small"
      onClick={handleClick}
      disabled={!buyerNumber || saving}
      startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <EventAvailableIcon />}
      sx={isConfirmed ? {
        bgcolor: 'grey.500',
        color: '#fff',
        '&:hover': { bgcolor: 'grey.600' },
      } : undefined}
    >
      カレンダー●OK
    </Button>
  );
};

export default ViewingPrepCalendarOkButton;
