"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const EmailService_supabase_1 = require("../services/EmailService.supabase");
const router = (0, express_1.Router)();
// 全てのルートに認証を適用
router.use(auth_1.authenticate);
/**
 * テストメール送信エンドポイント
 * POST /api/test-email/send
 *
 * ログイン中のユーザー自身にテストメールを送信する
 */
router.post('/send', async (req, res) => {
    try {
        const { recipientEmail, recipientName, subject, content, htmlBody, from = 'tenant@ifoo-oita.com', } = req.body;
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
        // EmailServiceを使用してメール送信
        const emailService = new EmailService_supabase_1.EmailService();
        await emailService.sendEmailWithCcAndAttachments({
            to: recipientEmail,
            subject,
            body: htmlBody || content,
            from,
            isHtml: true, // HTMLメールとして送信
        });
        console.log('[TestEmail] Test email sent successfully');
        res.status(200).json({
            success: true,
            message: 'テストメールを送信しました',
            recipientEmail,
        });
    }
    catch (error) {
        console.error('[TestEmail] Failed to send test email:', error);
        res.status(500).json({
            error: 'テストメールの送信に失敗しました',
            details: error.message,
        });
    }
});
exports.default = router;
