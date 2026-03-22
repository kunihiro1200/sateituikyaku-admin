import { Router } from 'express';
import { EmailService } from '../services/EmailService';
import { BuyerService } from '../services/BuyerService';
import { EmailHistoryService } from '../services/EmailHistoryService';
import { ActivityLogService } from '../services/ActivityLogService';
import { createClient } from '@supabase/supabase-js';

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
router.post('/send', async (req, res) => {
  try {
    const { buyerId, propertyIds, senderEmail, subject, body } = req.body;

    if (!buyerId || !subject || !body) {
      return res.status(400).json({ error: 'buyerId, subject, body は必須です' });
    }

    // 買主情報を取得
    const buyer = await buyerService.getById(buyerId);
    if (!buyer || !buyer.email) {
      return res.status(404).json({ error: '買主が見つからないか、メールアドレスが登録されていません' });
    }

    // メール送信
    const result = await emailService.sendBuyerEmail({
      to: buyer.email,
      subject,
      body,
      from: senderEmail,
    });

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
    const employeeId = (req as any).user?.id || COMPANY_ACCOUNT_UUID;

    // email_history テーブルに記録
    try {
      await emailHistoryService.saveEmailHistory({
        buyerId,
        propertyNumbers,
        recipientEmail: buyer.email,
        subject,
        body,
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
        buyerId,
        propertyNumbers,
        recipientEmail: buyer.email,
        subject,
        senderEmail: senderEmail || 'tenant@ifoo-oita.com',
        createdBy: employeeId,
      });
    } catch (err) {
      console.error('[gmail/send] activity_log保存エラー:', err);
      // ログ保存失敗はレスポンスに影響させない
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[gmail/send] エラー:', error);
    res.status(500).json({ error: 'メール送信に失敗しました' });
  }
});

export default router;
