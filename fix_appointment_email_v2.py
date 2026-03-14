#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
buyer-appointments.ts のメール本文修正:
1. 内覧日の注意書き（）を削除
2. URLを本番環境に変更
3. キャンセルメール送信エンドポイントを追加
"""

with open('backend/src/routes/buyer-appointments.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: 内覧日の注意書きを削除
old = '`内覧日(★下記日程が空欄の場合は、キャンセルされたという意味です）：${dateStr}(${weekday})`,'
new = '`内覧日：${dateStr}(${weekday})`,'
text = text.replace(old, new)

# 修正2: frontendUrl の取得を本番URLに変更（メール本文内）
old = "          const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();"
new = "          const frontendUrl = (process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim();"
text = text.replace(old, new)

# 修正3: カレンダーイベントの説明文内のURLも本番に変更
old = "        `買主詳細ページ:\\n${(process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim()}/buyers/${buyerNumber}`;"
new = "        `買主詳細ページ:\\n${(process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim()}/buyers/${buyerNumber}`;"
text = text.replace(old, new)

# 修正4: キャンセルメール送信エンドポイントを追加（export default router の直前）
cancel_endpoint = '''
/**
 * 内覧キャンセル通知メールを送信
 * 内覧日が空欄になった（キャンセルされた）ときに呼び出す
 */
router.post(
  '/cancel-notification',
  [
    body('buyerNumber').isString().withMessage('Invalid buyer number'),
    body('propertyAddress').optional().isString(),
    body('propertyNumber').optional().isString(),
    body('assignedTo').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      console.log('[BuyerAppointments] POST /cancel-notification - Request received');

      const { buyerNumber, propertyAddress, propertyNumber, assignedTo, inquiryHearing } = req.body;

      const recipients: string[] = [];

      // 1. 担当者のメールアドレスを追加
      if (assignedTo) {
        try {
          const assignedEmployee = await employeeUtils.getEmployeeByInitials(assignedTo);
          if (assignedEmployee?.email) {
            recipients.push(assignedEmployee.email);
          }
        } catch (e) {
          console.warn('[BuyerAppointments] Could not resolve assignedTo for cancel:', assignedTo);
        }
      }

      // 2. 物件担当者のメールアドレスを追加
      if (propertyNumber) {
        try {
          const { data: propertyData } = await supabase
            .from('property_listings')
            .select('sales_assignee')
            .eq('property_number', propertyNumber)
            .single();
          if (propertyData?.sales_assignee) {
            const salesEmployee = await employeeUtils.getEmployeeByInitials(propertyData.sales_assignee);
            if (salesEmployee?.email && !recipients.includes(salesEmployee.email)) {
              recipients.push(salesEmployee.email);
            }
          }
        } catch (e) {
          console.warn('[BuyerAppointments] Could not resolve sales_assignee for cancel:', propertyNumber);
        }
      }

      // 3. 国広智子（固定）を追加
      const kunihiroEmail = 'tomoko.kunihiro@ifoo-oita.com';
      if (!recipients.includes(kunihiroEmail)) {
        recipients.push(kunihiroEmail);
      }

      const frontendUrl = (process.env.FRONTEND_URL || 'https://sateituikyaku-admin-frontend.vercel.app').split(',')[0].trim();

      const subject = `【キャンセル】${propertyAddress || '物件住所未設定'}の内覧がキャンセルされました`;
      const body = [
        `この内覧はキャンセルされました。`,
        ``,
        `${assignedTo || ''}`,
        `物件所在地「${propertyAddress || 'なし'}」`,
        `内覧日：（キャンセル済み）`,
        `問合時コメント：${inquiryHearing || 'なし'}`,
        `買主番号：${buyerNumber}`,
        `物件番号：${propertyNumber || 'なし'}`,
        ``,
        `${frontendUrl}/buyers/${buyerNumber}`,
      ].join('\\n');

      await emailService.sendEmail({ to: recipients, subject, body });
      console.log('[BuyerAppointments] Cancel notification email sent to:', recipients);

      res.status(200).json({ success: true, recipients });
    } catch (error: any) {
      console.error('[BuyerAppointments] Failed to send cancel notification:', error.message);
      res.status(500).json({
        error: {
          code: 'CANCEL_NOTIFICATION_ERROR',
          message: error.message,
          retryable: true,
        },
      });
    }
  }
);

'''

text = text.replace('export default router;\n', cancel_endpoint + 'export default router;\n')

with open('backend/src/routes/buyer-appointments.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# 確認
with open('backend/src/routes/buyer-appointments.ts', 'rb') as f:
    result = f.read().decode('utf-8')

if '内覧日：${dateStr}' in result:
    print('OK: 内覧日の注意書き削除済み')
else:
    print('NG: 内覧日の修正失敗')

if 'sateituikyaku-admin-frontend.vercel.app' in result:
    print('OK: 本番URLに変更済み')
else:
    print('NG: URL変更失敗')

if 'cancel-notification' in result:
    print('OK: キャンセルエンドポイント追加済み')
else:
    print('NG: キャンセルエンドポイント追加失敗')
