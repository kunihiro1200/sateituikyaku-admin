import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { Box } from '@mui/material';

interface DecisionFieldsBlockDialogProps {
  open: boolean;
  onGoToFields: () => void;
}

/**
 * 遷移ブロックダイアログ
 * 状況（当社）で専任・他決系ステータスを選択した状態で、専任（他決）決定日・競合・
 * 専任・他決要因のいずれかが未入力の場合に表示し、遷移を完全にブロックする。
 * ステータス選択直後には表示せず、ページ遷移のタイミングでのみ表示する。
 */
export default function DecisionFieldsBlockDialog({ open, onGoToFields }: DecisionFieldsBlockDialogProps) {
  return (
    <Dialog
      open={open}
      // onCloseを設定しない（ダイアログ外クリックやEscでの閉じを防ぐ）
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          専任（他決）決定日を入力してください
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography>
          専任・他決系のステータスでは、専任（他決）決定日・競合・専任・他決要因の入力が必須です。
          <br />
          入力してから移動してください。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onGoToFields}
          color="primary"
          variant="contained"
          autoFocus
        >
          入力する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
