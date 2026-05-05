import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface TestGmailSendButtonProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'text' | 'outlined' | 'contained';
  previewData?: any; // スクレイピングデータ
  previewUrl?: string; // プレビューURL
}

const SIGNATURE = `*****************************
株式会社いふう
大分市舞鶴町1-3-30
TEL:097-533-2022
******************************`;

/**
 * テスト送信専用のGmailボタン
 * 物件選択不要で、任意のメールアドレスにテストメールを送信できる
 * スクレイピングデータがある場合は、そのデータを使用
 */
export default function TestGmailSendButton({
  size = 'small',
  variant = 'outlined',
  previewData,
  previewUrl,
}: TestGmailSendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  
  // スクレイピングデータを使用（必須）
  const propertyAddress = previewData?.details?.['所在地'] || previewData?.address || '住所情報なし';
  const propertyPrice = previewData?.details?.['価格'] || previewData?.price || '価格情報なし';
  const linkUrl = previewUrl || '';
  
  // 画像: スクレイピングデータから取得（必須）
  const images = previewData?.images?.slice(0, 3) || [];
  
  // 物件詳細情報（スクレイピングデータから取得）
  const propertyDetails = [];
  if (previewData?.details?.['間取り']) propertyDetails.push(`間取り: ${previewData.details['間取り']}`);
  if (previewData?.details?.['専有面積']) propertyDetails.push(`面積: ${previewData.details['専有面積']}`);
  if (previewData?.details?.['階建 / 階'] || previewData?.details?.['階建/階']) {
    const floorInfo = previewData.details['階建 / 階'] || previewData.details['階建/階'];
    propertyDetails.push(`階: ${floorInfo}`);
  }
  if (previewData?.details?.['築年月']) propertyDetails.push(`築年月: ${previewData.details['築年月']}`);
  if (previewData?.details?.['駐車場']) propertyDetails.push(`駐車場: ${previewData.details['駐車場']}`);
  if (previewData?.details?.['交通']) propertyDetails.push(`交通: ${previewData.details['交通']}`);
  
  const [subject, setSubject] = useState(`${propertyAddress}/${propertyPrice}/おまたせしました！新着物件です！`);
  
  // 本番と同じHTML形式の本文（画像3枚埋め込み）
  const generateHtmlBody = (recipientName: string) => {
    // 画像が存在しない場合は空文字列
    const imageHtml = images.length > 0 
      ? images.map((imgSrc, index) => 
          `<img src="${imgSrc}" alt="物件画像${index + 1}" style="max-width: 600px; width: 100%; height: auto; margin: 10px 0; display: block;" />`
        ).join('')
      : '';
    
    const propertyInfo = propertyDetails.join('<br>');
    
    // URLが存在しない場合はリンクを表示しない
    const linkSection = linkUrl 
      ? `他の画像はこちらから<br><a href="${linkUrl}">${linkUrl}</a><br><br>`
      : '';
    
    return `${recipientName}様<br><br>大変お世話になっております。<br>不動産会社の㈱いふうです。<br><br>新着物件がでましたので、ご案内致します。<br><br>${propertyAddress}/${propertyPrice}/<br><br>${imageHtml}<br>${linkSection}${propertyInfo}<br>${SIGNATURE.replace(/\n/g, '<br>')}`;
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
    console.log('[TestGmailSendButton] previewData:', previewData);
    console.log('[TestGmailSendButton] previewUrl:', previewUrl);
    console.log('[TestGmailSendButton] images:', images);
    console.log('[TestGmailSendButton] propertyAddress:', propertyAddress);
    console.log('[TestGmailSendButton] propertyPrice:', propertyPrice);
    console.log('[TestGmailSendButton] linkUrl:', linkUrl);
    
    if (!employee?.email) {
      setSnackbar({
        open: true,
        message: 'ログイン情報が取得できません。再度ログインしてください。',
        severity: 'error'
      });
      return;
    }
    
    // スクレイピングデータが存在しない場合はエラー
    if (!previewData || !previewUrl) {
      setSnackbar({
        open: true,
        message: 'スクレイピングデータが存在しません。先に「物件情報を取得」ボタンをクリックしてください。',
        severity: 'error'
      });
      return;
    }
    
    // 画像が存在しない場合はエラー
    if (!images || images.length === 0) {
      setSnackbar({
        open: true,
        message: 'スクレイピングした画像が存在しません。',
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
