import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { onSessionExpired, forceLogoutRedirect } from '../services/api';

/**
 * セッション切れ警告ダイアログ
 * 
 * 即座にログイン画面にリダイレクトせず、
 * ユーザーに「入力中のデータを保存してからログインし直してください」と警告する。
 * 
 * 「戻って保存する」ボタンでダイアログを閉じ、元の画面で保存操作を行える。
 * 「ログイン画面へ」を押した時点でリダイレクトする。
 * 
 * ※セッション切れ後はAPIリクエストは失敗するが、
 *   ローカル保存やコピー操作は可能。再ログイン後にデータを貼り付けて保存できる。
 */
export default function SessionExpiredDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSessionExpired.subscribe(() => {
      setOpen(true);
    });
    return unsubscribe;
  }, []);

  const handleGoToLogin = () => {
    setOpen(false);
    forceLogoutRedirect();
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
        ⚠️ セッションが切れました
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          ログインの有効期限が切れました。
        </Alert>
        <Typography variant="body1" sx={{ mb: 1 }}>
          入力中のデータがある場合は、<strong>「戻って保存する」を押して画面に戻り、保存ボタンを押してください。</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          ※ セッション切れ後もローカル保存は可能です。保存後に再ログインしてください。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          「ログイン画面へ」を押すと、現在のページから移動します（入力中のデータは失われます）。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={handleClose}
          size="large"
        >
          戻って保存する
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGoToLogin}
          size="large"
        >
          ログイン画面へ
        </Button>
      </DialogActions>
    </Dialog>
  );
}
