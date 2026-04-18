import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
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
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, backgroundColor: '#fff3f3' }}>
        <WarningAmberIcon sx={{ color: '#d32f2f', fontSize: 32 }} />
        <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 'bold' }}>
          ⚠️ 警告
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ backgroundColor: '#fff3f3', pt: 2 }}>
        <Box sx={{ textAlign: 'center', py: 1 }}>
          <Typography
            variant="h6"
            sx={{ color: '#d32f2f', fontWeight: 'bold', lineHeight: 1.8 }}
          >
            今月の角井さんの訪問査定割合が
          </Typography>
          <Typography
            variant="h5"
            sx={{ color: '#d32f2f', fontWeight: 'bold', lineHeight: 1.8 }}
          >
            15%を超えています！！
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: '#d32f2f', fontWeight: 'bold', lineHeight: 1.8, mt: 1 }}
          >
            他の方へ訪問査定お願いしてください！！
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: '#d32f2f', mt: 1 }}
          >
            （現在 {ratio.toFixed(1)}%）
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ backgroundColor: '#fff3f3', pb: 2, px: 3, gap: 1 }}>
        <Button onClick={onCancel} color="error" variant="contained" fullWidth>
          キャンセル
        </Button>
        <Button onClick={onContinue} variant="outlined" color="error" fullWidth>
          このまま続ける
        </Button>
      </DialogActions>
    </Dialog>
  );
};
