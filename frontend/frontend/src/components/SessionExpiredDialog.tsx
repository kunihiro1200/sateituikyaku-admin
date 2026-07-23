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
 * ユーザーが「ログイン画面へ」を押した時点でリダイレクトする。
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

  return (
    <Dialog
      open={open}
      onClose={() => {}} // 背景クリックで閉じない
      disableEscapeKeyDown // Escで閉じない
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
          入力中のデータがある場合は、<strong>先にコピーや保存をしてから</strong>ログインし直してください。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          「ログイン画面へ」を押すと、現在のページから移動します。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
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
