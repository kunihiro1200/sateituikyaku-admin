import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { sendEmailWithCcAndAttachments } from '../services/gmailService';

const router = Router();

// 全てのルートに認証を適用
router.use(authenticate);

/**
 * テストメール送信エンドポイント
 * POST /api/test-email/send
 * 
 * ログイン中のユーザー自身にテストメールを送信する
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const {
      recipientEmail,
      recipientName,
      subject,
      content,
      htmlBody,
      from = 'tenant@ifoo-oita.com',
    } = req.body;

    // バリデーション
    if (!recipientEmail || !subject || !content) {
      return res.status(400).json({
        error: '必須フィールドが不足しています（recipientEmail, subject, content）'
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({
        error: '無効なメールアドレス形式です'
      });
    }

    console.log('[TestEmail] Sending test email:', {
      to: recipientEmail,
      from,
      subject,
    });

    // Gmail APIを使用してメール送信
    await sendEmailWithCcAndAttachments(
      recipientEmail,
      subject,
      htmlBody || content,
      from,
      undefined, // CC
      undefined  // attachments
    );

    console.log('[TestEmail] Test email sent successfully');

    res.status(200).json({
      success: true,
      message: 'テストメールを送信しました',
      recipientEmail,
    });
  } catch (error: any) {
    console.error('[TestEmail] Failed to send test email:', error);
    res.status(500).json({
      error: 'テストメールの送信に失敗しました',
      details: error.message,
    });
  }
});

export default router;
