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

interface MatchingUpdatePromptDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onSkip: () => void;
}

/**
 * 内覧結果更新時にマッチング更新を促すダイアログ
 * 受付日が2026/8/22以降、または内覧日が2026/8/22以降で
 * ヒアリング項目が更新された場合に表示
 */
export default function MatchingUpdatePromptDialog({
  open,
  onClose,
  onUpdate,
  onSkip,
}: MatchingUpdatePromptDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        希望条件のマッチングを更新しますか？
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            内覧結果・後続対応のヒアリング項目が更新されました。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            希望条件の「売主をマッチング」を更新することで、最新の希望条件に基づいた売主候補を検索できます。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onSkip} 
          color="inherit"
        >
          更新しない
        </Button>
        <Button 
          onClick={onUpdate} 
          variant="contained" 
          color="primary"
          autoFocus
        >
          希望条件ページに遷移して更新する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
