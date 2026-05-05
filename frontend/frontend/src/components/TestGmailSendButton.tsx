import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface TestGmailSendButtonProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
}

const SIGNATURE = `*****************************
株式会社いふう
大分市舞鶴町1-3-30
TEL:097-533-2022
******************************`;

/**
 * テスト送信専用のGmailボタン
 * 物件選択不要で、ログイン中のユーザー自身にテストメールを送信できる
 */
export default function TestGmailSendButton({
  size = 'small',
  variant = 'outlined',
}: TestGmailSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState('【テスト送信】新着物件のご案内');
  const [body, setBody] = useState(
    `{お客様名}様\n` +
    `いつもお世話になっております。\n` +
    `新着物件のご案内です。\n\n` +
    `物件住所: {物件住所}\n` +
    `種別：{物件種別}\n` +
    `価格：{価格}\n` +
    `詳細情報：{詳細URL}\n\n` +
    `詳細はお問い合わせください。\n\n` +
    `よろしくお願いいたします。\n\n` +
    `${SIGNATURE}`
  );
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const { employee } = useAuthStore();

  const handleButtonClick = () => {
    if (!employee?.email) {
      setSnackbar({
        open: true,
        message: 'ログイン情報が取得できません。再度ログインしてください。',
        severity: 'error'
      });
      return;
    }
    setDialogOpen(true);
  };

  const handleSend = async () => {
    if (!employee?.email) {
      setSnackbar({
        open: true,
        message: 'ログイン情報が取得できません。',
        severity: 'error'
      });
      return;
    }

    setLoading(true);

    try {
      // プレーンテキストの改行をHTMLの<br>に変換
      const htmlBody = body.replace(/\n/g, '<br>');

      // テスト送信用のAPIエンドポイントを呼び出し
      const response = await api.post('/api/test-email/send', {
        recipientEmail: employee.email,
        recipientName: employee.name,
        subject,
        content: body,
        htmlBody,
        from: 'tenant@ifoo-oita.com',
      });

      setDialogOpen(false);
      setSnackbar({
        open: true,
        message: `テストメールを送信しました\n送信先: ${employee.email}`,
        severity: 'success'
      });
    } catch (error: any) {
      console.error('Failed to send test email:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'テストメールの送信に失敗しました',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        startIcon={<EmailIcon />}
        onClick={handleButtonClick}
        disabled={loading}
      >
        自分にテスト送信
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>テストメール送信</DialogTitle>
        <DialogContent>
          <TextField
            label="送信先"
            value={employee?.email || ''}
            disabled
            fullWidth
            margin="normal"
            helperText="ログイン中のユーザーのメールアドレスに送信されます"
          />
          <TextField
            label="件名"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="本文"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            rows={12}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button
            onClick={handleSend}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <EmailIcon />}
          >
            送信
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
