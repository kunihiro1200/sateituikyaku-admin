import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

export interface OfferFailedChatSentPopupProps {
  open: boolean;
  onOk: () => void; // 「OK」ボタン押下時
}

/**
 * 買付ハズレチャット送信完了後のリマインダーポップアップコンポーネント
 * 「★最新状況」の更新を促すメッセージを表示する
 */
export const OfferFailedChatSentPopup: React.FC<OfferFailedChatSentPopupProps> = ({
  open,
  onOk,
}) => {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography variant="body1" sx={{ py: 1 }}>
          正確な★最新状況を入力してください。注意！！ 『買付外れました』以外です！！
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        <Button
          onClick={onOk}
          variant="contained"
          color="primary"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfferFailedChatSentPopup;
