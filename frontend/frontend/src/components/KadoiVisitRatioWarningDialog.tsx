import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface KadoiVisitRatioWarningDialogProps {
  open: boolean;
  ratio: number;
  onContinue: () => void;
  onCancel: () => void;
}

export const KadoiVisitRatioWarningDialog: React.FC<KadoiVisitRatioWarningDialogProps> = ({
  open,
  ratio,
  onContinue,
  onCancel,
}) => {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        訪問査定割合の警告
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          今月の角井の訪問査定割合が15%を超えています（現在{ratio.toFixed(1)}%）。このまま登録しますか？
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>キャンセル</Button>
        <Button onClick={onContinue} color="warning" variant="contained">
          続ける
        </Button>
      </DialogActions>
    </Dialog>
  );
};
