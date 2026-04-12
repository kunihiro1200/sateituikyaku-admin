import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { Box } from '@mui/material';

interface NavigationBlockDialogProps {
  open: boolean;
  onGoToNextCallDate: () => void;
}

/**
 * 遷移ブロックダイアログ
 * 追客中の売主で次電日が未入力の場合に表示し、遷移を完全にブロックする。
 * 「このまま移動する」ボタンは提供しない。
 */
export default function NavigationBlockDialog({ open, onGoToNextCallDate }: NavigationBlockDialogProps) {
  return (
    <Dialog
      open={open}
      // onCloseを設定しない（ダイアログ外クリックやEscでの閉じを防ぐ）
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          次電日が未入力です
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography>
          追客中の売主は次電日の入力が必須です。
          <br />
          次電日を入力してから移動してください。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onGoToNextCallDate}
          color="primary"
          variant="contained"
          autoFocus
        >
          次電日を入力する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
