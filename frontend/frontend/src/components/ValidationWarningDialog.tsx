import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// 希望条件の必須フィールドラベル
const DESIRED_CONDITION_LABELS = ['エリア（希望条件）', '予算（希望条件）', '希望種別（希望条件）'];

interface ValidationWarningDialogProps {
  open: boolean;
  missingFieldLabels: string[];
  onProceed: () => void;
  onStay: () => void;
  onGoToDesiredConditions?: () => void;
  /** trueの場合、「このまま移動する」ボタンを非表示にして遷移をブロックする */
  blockNavigation?: boolean;
}

export function ValidationWarningDialog({
  open,
  missingFieldLabels,
  onProceed,
  onStay,
  onGoToDesiredConditions,
  blockNavigation = false,
}: ValidationWarningDialogProps) {
  // 希望条件の必須項目が未入力かどうか
  const hasDesiredConditionsMissing = missingFieldLabels.some((label) =>
    DESIRED_CONDITION_LABELS.includes(label)
  );

  return (
    <Dialog open={open} onClose={onStay} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        必須項目が未入力です
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          以下の項目が未入力です。
          {blockNavigation
            ? '入力するまでこのページから移動できません。'
            : hasDesiredConditionsMissing
            ? '希望条件を入力してください。'
            : 'このまま移動しますか？'}
        </Typography>
        <Box sx={{ bgcolor: 'warning.light', borderRadius: 1, px: 2, py: 1 }}>
          <List dense disablePadding>
            {missingFieldLabels.map((label) => (
              <ListItem key={label} disablePadding sx={{ py: 0.25 }}>
                <ListItemText
                  primary={`・${label}`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {!blockNavigation && (
          hasDesiredConditionsMissing ? (
            // 希望条件が未入力の場合：「希望条件に移動する」ボタン
            <Button
              variant="outlined"
              color="warning"
              onClick={onGoToDesiredConditions ?? onProceed}
            >
              希望条件に移動する
            </Button>
          ) : (
            // 希望条件以外の未入力の場合：「このまま移動する」ボタン
            <Button
              variant="outlined"
              color="warning"
              onClick={onProceed}
            >
              このまま移動する
            </Button>
          )
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={onStay}
          autoFocus
        >
          画面に留まる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
