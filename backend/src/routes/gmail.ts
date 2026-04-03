import { Router } from 'express';
import multer from 'multer';
import { EmailService } from '../services/EmailService';
import { BuyerService } from '../services/BuyerService';
import { EmailHistoryService } from '../services/EmailHistoryService';
import { ActivityLogService } from '../services/ActivityLogService';
import { createClient } from '@supabase/supabase-js';

// 添付ファイルはメモリに保持（25MB上限）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();
const emailService = new EmailService();
const buyerService = new BuyerService();
const emailHistoryService = new EmailHistoryService();
const activityLogService = new ActivityLogService();

// 会社アカウントのフォールバックUUID（employee_idがNOT NULL制約のため）
const COMPANY_ACCOUNT_UUID = '66e35f74-7c31-430d-b235-5ad515581007';

// 買主へのGmail送信エンドポイント（旧）
router.post('/send-to-buyer', async (req, res) => {
  try {
    const { buyerId, templateId, customizations } = req.body;

    // 買主情報を取得
    const buyer = await buyerService.getById(buyerId);
    if (!buyer || !buyer.email) {
      return res.status(404).json({ error: '買主が見つからないか、メールアドレスが登録されていません' });
    }

    // メール送信
    await emailService.sendEmail({
      to: [buyer.email],
      subject: customizations?.subject || 'お問い合わせの物件について',
      body: customizations?.body || '',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Gmail送信エラー:', error);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

// 買主へのGmail送信エンドポイント（新・履歴記録あり）
router.post('/send', upload.array('attachments'), async (req, res) => {
  // multipart/form-data と JSON の両方に対応
  const body = req.body;
  const { buyerId, propertyIds, senderEmail, subject, templateName } = body;
  const bodyText = body.body;
  const attachments = (req.files as Express.Multer.File[]) || [];
  
  try {

    if (!buyerId || !subject || !bodyText) {
      return res.status(400).json({ error: 'buyerId, subject, body は必須です' });
    }

    // 買主情報を取得
    const buyer = await buyerService.getById(buyerId);
    if (!buyer || !buyer.email) {
      return res.status(404).json({ error: '買主が見つからないか、メールアドレスが登録されていません' });
    }

    // メール送信（30秒タイムアウト）
    const sendWithTimeout = Promise.race([
      emailService.sendBuyerEmail({
        to: buyer.email,
        subject,
        body: bodyText,
        from: senderEmail,
        attachments,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('メール送信がタイムアウトしました（30秒）。ネットワーク接続を確認してください。')), 30000)
      ),
    ]);

    const result = await sendWithTimeout;

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'メール送信に失敗しました' });
    }

    // propertyIds（property_listings.id）を property_number に変換
    let propertyNumbers: string[] = [];
    if (propertyIds && propertyIds.length > 0) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: listings } = await supabase
          .from('property_listings')
          .select('property_number')
          .in('id', propertyIds);
        propertyNumbers = (listings || []).map((l: any) => l.property_number).filter(Boolean);
      } catch (err) {
        console.error('[gmail/send] property_number変換エラー:', err);
        // 変換失敗してもメール送信は成功しているので続行
      }
    }

    // employee_id を取得（未ログイン時は会社アカウントUUIDをフォールバック）
    const employeeId = (req as any).employee?.id || COMPANY_ACCOUNT_UUID;

    // email_history テーブルに記録
    try {
      await emailHistoryService.saveEmailHistory({
        buyerId: buyer.buyer_number || buyerId,
        propertyNumbers,
        recipientEmail: buyer.email,
        subject,
        body: bodyText,
        senderEmail: senderEmail || 'tenant@ifoo-oita.com',
        emailType: 'gmail_send',
      });
    } catch (err) {
      console.error('[gmail/send] email_history保存エラー:', err);
      // 履歴保存失敗はレスポンスに影響させない
    }

    // activity_logs テーブルに記録
    try {
      await activityLogService.logEmail({
        buyerId: buyer.buyer_number || buyerId,
        propertyNumbers,
        recipientEmail: buyer.email,
        subject,
        templateName: templateName || undefined,
        senderEmail: senderEmail || 'tenant@ifoo-oita.com',
        createdBy: employeeId,
      });
    } catch (err) {
      console.error('[gmail/send] activity_log保存エラー:', err);
      // ログ保存失敗はレスポンスに影響させない
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[gmail/send] 詳細エラー:', {
      buyerId: buyerId,
      subject: subject,
      bodyLength: bodyText?.length || 0,
      senderEmail: senderEmail,
      attachmentsCount: attachments?.length || 0,
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code,
    });
    
    // エラー種別に応じたレスポンス
    if (error.message === 'GOOGLE_AUTH_REQUIRED') {
      return res.status(401).json({ 
        error: 'Google認証が必要です。管理者に連絡してください。',
        code: 'GOOGLE_AUTH_REQUIRED',
      });
    }
    
    if (error.code === 'quotaExceeded' || error.code === 'rateLimitExceeded') {
      return res.status(429).json({ 
        error: 'Gmail APIの送信制限に達しました。しばらく待ってから再度お試しください。',
        code: 'QUOTA_EXCEEDED',
      });
    }
    
    res.status(500).json({ 
      error: 'メール送信に失敗しました',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: 'EMAIL_SEND_ERROR',
    });
  }
});

export default router;
