#!/usr/bin/env python3
# backend/src/routes/propertyListings.ts の send-report-email エンドポイントを
# multipart/form-data (multer) 対応に修正し、CC・添付ファイルをサポートする

with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. multerのimportを追加（Router importの後に追加）
old_import = "const router = Router();"
new_import = """const router = Router();

// multer: multipart/form-data (添付ファイル) 対応
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });"""

if old_import in text and 'multer' not in text:
    text = text.replace(old_import, new_import, 1)
    print('✅ multer import を追加しました')
else:
    print('⚠️ multer import はすでに存在するか、対象が見つかりません')

# 2. send-report-email エンドポイントを multipart/form-data 対応に修正
old_endpoint = """// 報告書メール送信（Gmail API で直接送信 + 送信履歴の記録）
router.post('/:propertyNumber/send-report-email', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { to, subject, body, template_name, report_date, report_assignee, report_completed, from } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({ error: '宛先・件名・本文は必須です' });
      return;
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // Gmail API で直接送信
    const dummySeller = {
      id: propertyNumber,
      seller_number: propertyNumber,
      name: '',
      email: to,
      phone_number: '',
      property_address: '',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const senderAddress = from || req.employee?.email || 'tenant@ifoo-oita.com';
    const employeeId = req.employee?.id || 'system';

    console.log('[send-report-email] Sending email:', {
      propertyNumber,
      to,
      subject,
      senderAddress,
      employeeId,
      hasGmailRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      hasGoogleCalendarClientId: !!process.env.GOOGLE_CALENDAR_CLIENT_ID,
    });

    const result = await emailService.sendTemplateEmail(
      dummySeller as any,
      subject,
      body,
      senderAddress,
      employeeId,
      undefined,
      senderAddress
    );

    console.log('[send-report-email] Result:', { success: result.success, error: result.error, messageId: result.messageId });

    if (!result.success) {
      const errorMsg = result.error || 'メール送信に失敗しました';
      // Gmail認証エラーの場合は分かりやすいメッセージを返す
      if (errorMsg.includes('GOOGLE_AUTH_REQUIRED') || errorMsg.includes('認証') || errorMsg.includes('not configured')) {
        res.status(500).json({ 
          error: 'Gmail認証が必要です。管理者にGoogle連携の設定を依頼してください。',
          detail: errorMsg
        });
      } else {
        res.status(500).json({ error: errorMsg });
      }
      return;
    }

    // 送信履歴を記録
    await supabase.from('property_report_history').insert({
      property_number: propertyNumber,
      template_name: template_name || null,
      subject,
      body,
      report_date: report_date || null,
      report_assignee: report_assignee || null,
      report_completed: report_completed || 'N',
      sent_at: new Date().toISOString(),
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('[send-report-email] Unexpected error:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'メール送信に失敗しました' });
  }
});"""

new_endpoint = """// 報告書メール送信（Gmail API で直接送信 + 送信履歴の記録）
// multipart/form-data 対応（添付ファイル・CC をサポート）
router.post('/:propertyNumber/send-report-email', authenticate, upload.array('attachments', 10), async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { to, cc, subject, body, template_name, report_date, report_assignee, report_completed, from } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;

    if (!to || !subject || !body) {
      res.status(400).json({ error: '宛先・件名・本文は必須です' });
      return;
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    const senderAddress = from || req.employee?.email || 'tenant@ifoo-oita.com';
    const employeeId = req.employee?.id || 'system';

    console.log('[send-report-email] Sending email:', {
      propertyNumber,
      to,
      cc: cc || '(none)',
      subject,
      senderAddress,
      employeeId,
      attachmentCount: files?.length || 0,
      hasGmailRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN,
      hasGoogleCalendarClientId: !!process.env.GOOGLE_CALENDAR_CLIENT_ID,
    });

    // 添付ファイルを EmailAttachment 形式に変換
    const attachments = (files || []).map((file) => ({
      filename: file.originalname,
      mimeType: file.mimetype,
      data: file.buffer,
      cid: `attachment-${Date.now()}-${file.originalname}`,
    }));

    // Gmail API で直接送信
    const dummySeller = {
      id: propertyNumber,
      seller_number: propertyNumber,
      name: '',
      email: to,
      phone_number: '',
      property_address: '',
      created_at: new Date(),
      updated_at: new Date(),
    };

    let result;
    if (attachments.length > 0 || cc) {
      // 添付ファイルまたはCCがある場合は sendEmailWithCcAndAttachments を使用
      result = await emailService.sendEmailWithCcAndAttachments({
        to,
        cc: cc || undefined,
        subject,
        body,
        from: senderAddress,
        attachments,
      });
    } else {
      result = await emailService.sendTemplateEmail(
        dummySeller as any,
        subject,
        body,
        senderAddress,
        employeeId,
        undefined,
        senderAddress
      );
    }

    console.log('[send-report-email] Result:', { success: result.success, error: result.error, messageId: result.messageId });

    if (!result.success) {
      const errorMsg = result.error || 'メール送信に失敗しました';
      if (errorMsg.includes('GOOGLE_AUTH_REQUIRED') || errorMsg.includes('認証') || errorMsg.includes('not configured')) {
        res.status(500).json({ 
          error: 'Gmail認証が必要です。管理者にGoogle連携の設定を依頼してください。',
          detail: errorMsg
        });
      } else {
        res.status(500).json({ error: errorMsg });
      }
      return;
    }

    // 送信履歴を記録
    await supabase.from('property_report_history').insert({
      property_number: propertyNumber,
      template_name: template_name || null,
      subject,
      body,
      report_date: report_date || null,
      report_assignee: report_assignee || null,
      report_completed: report_completed || 'N',
      sent_at: new Date().toISOString(),
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error('[send-report-email] Unexpected error:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'メール送信に失敗しました' });
  }
});"""

if old_endpoint in text:
    text = text.replace(old_endpoint, new_endpoint)
    print('✅ send-report-email エンドポイントを multipart/form-data 対応に修正しました')
else:
    print('❌ send-report-email エンドポイントが見つかりませんでした')

with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
