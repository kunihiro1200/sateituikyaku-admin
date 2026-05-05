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

// ダミー画像URL（3枚）- 実際に表示される画像URLを使用
const DUMMY_IMAGES = [
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&h=400&fit=crop',
];

// プレビューURL（実在するURL）
const PREVIEW_URL = 'https://sateituikyaku-admin-frontend.vercel.app/public/properties';

/**
 * テスト送信専用のGmailボタン
 * 物件選択不要で、任意のメールアドレスにテストメールを送信できる
 * 本番と全く同じ形式（画像3枚埋め込み）
 */
export default function TestGmailSendButton({
  size = 'small',
  variant = 'outlined',
}: TestGmailSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('大分市中央町1-1-1/2,190万円/おまたせしました！新着物件です！');
  
  // 本番と同じHTML形式の本文（画像3枚埋め込み）
  const generateHtmlBody = (recipientName: string) => {
    const imageHtml = DUMMY_IMAGES.map((imgSrc, index) => 
      `<img src="${imgSrc}" alt="物件画像${index + 1}" style="max-width: 600px; width: 100%; height: auto; margin: 10px 0; display: block;" />`
    ).join('');
    
    return `${recipientName}様<br><br>大変お世話になっております。<br>不動産会社の㈱いふうです。<br><br>新着物件がでましたので、ご案内致します。<br><br>大分市中央町1-1-1/2,190万円/<br><br>${imageHtml}<br>他の画像はこちらから<br><a href="${PREVIEW_URL}">${PREVIEW_URL}</a><br><br>間取り: 3LDK<br>面積: 85.50m²<br>階: 2階建<br>築年月: 2020年3月<br>駐車場: 2台<br>交通: JR日豊本線 大分駅 徒歩15分<br>${SIGNATURE.replace(/\n/g, '<br>')}`;
  };

  const [body, setBody] = useState(generateHtmlBody('{お客様名}'));
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
    // デフォルトの送信先をログイン中のユーザーのメールアドレスに設定
    setRecipientEmail(employee.email);
    // 本文を再生成（ログイン中のユーザー名を使用）
    setBody(generateHtmlBody(employee.name || 'お客様'));
    setDialogOpen(true);
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientEmail.trim()) {
      setSnackbar({
        open: true,
        message: '送信先メールアドレスを入力してください。',
        severity: 'error'
      });
      return;
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      setSnackbar({
        open: true,
        message: '有効なメールアドレスを入力してください。',
        severity: 'error'
      });
      return;
    }

    setLoading(true);

    try {
      // テスト送信用のAPIエンドポイントを呼び出し
      const response = await api.post('/api/test-email/send', {
        recipientEmail: recipientEmail.trim(),
        recipientName: employee?.name || 'お客様',
        subject,
        content: body.replace(/<br>/g, '\n').replace(/<[^>]*>/g, ''), // プレーンテキスト版
        htmlBody: body, // HTML版
        from: 'tenant@ifoo-oita.com',
      });

      setDialogOpen(false);
      setSnackbar({
        open: true,
        message: `テストメールを送信しました\n送信先: ${recipientEmail}`,
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
            label="送信先メールアドレス"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            fullWidth
            margin="normal"
            helperText="テスト送信先のメールアドレスを入力してください"
            type="email"
          />
          <TextField
            label="件名"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="本文（HTML形式）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            rows={16}
            margin="normal"
            helperText="本番と同じHTML形式（画像3枚埋め込み済み）"
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
