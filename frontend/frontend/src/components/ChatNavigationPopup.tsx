import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

export interface ChatNavigationPopupProps {
  open: boolean;
  onNavigate: () => void; // 「内覧ページ」ボタン押下時
  onClose: () => void;    // 「ここにとどまる」ボタン押下時
}

/**
 * Chat送信誘導ポップアップコンポーネント
 * 「★最新状況」で"買"を含む選択肢が保存された際に表示される
 */
export const ChatNavigationPopup: React.FC<ChatNavigationPopupProps> = ({
  open,
  onNavigate,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography variant="body1" sx={{ py: 1 }}>
          Chat送信のため　内覧ページに飛んでください
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        {/* 控えめボタン（左側） */}
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
        >
          ここにとどまる
        </Button>
        {/* 推奨・強調ボタン（右側） */}
        <Button
          onClick={onNavigate}
          variant="contained"
          color="primary"
        >
          内覧ページ
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChatNavigationPopup;
