import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';
import { Box } from '@mui/material';

interface NextCallDateReminderDialogProps {
  open: boolean;
  onGoToNextCallDate: () => void;
  onProceed: () => void;
}

/**
 * 次電日変更確認ダイアログ
 * 通話モードページで編集操作後、次電日を変更せずに遷移しようとした場合に表示する。
 * backdrop click は「次電日を変更する」と同じ動作にする。
 */
export default function NextCallDateReminderDialog({
  open,
  onGoToNextCallDate,
  onProceed,
}: NextCallDateReminderDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onGoToNextCallDate}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutlineIcon color="primary" />
          次電日は変更しましたか？
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography>
          次電日が変更されていません。
          <br />
          次電日を変更してから移動することをお勧めします。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onProceed}
          color="inherit"
          variant="outlined"
        >
          このまま移動する
        </Button>
        <Button
          onClick={onGoToNextCallDate}
          color="primary"
          variant="contained"
          autoFocus
        >
          次電日を変更する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
