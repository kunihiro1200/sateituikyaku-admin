#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""buyers.tsにsend-confirmationエンドポイントを追加するスクリプト"""

with open('backend/src/routes/buyers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 既に存在する場合はスキップ
if 'send-confirmation' in text:
    print('send-confirmation endpoint already exists, skipping.')
    exit(0)

new_endpoint = '''
// 担当への確認事項をGoogle Chatに送信
router.post('/:buyer_number/send-confirmation', async (req: Request, res: Response) => {
  try {
    const { buyer_number } = req.params;
    const { confirmationText, buyerDetailUrl } = req.body;

    console.log('[POST /buyers/:buyer_number/send-confirmation] Request received:', {
      buyer_number,
      confirmationTextLength: confirmationText?.length || 0,
      buyerDetailUrl
    });

    if (!confirmationText || confirmationText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '確認事項を入力してください'
      });
    }

    const buyer = await buyerService.getByBuyerNumber(buyer_number);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        error: '買主が見つかりませんでした'
      });
    }

    if (!buyer.property_number || buyer.property_number.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '物件番号が設定されていません'
      });
    }

    const properties = await buyerService.getLinkedProperties(buyer.buyer_id);
    if (!properties || properties.length === 0) {
      return res.status(400).json({
        success: false,
        error: '紐づく物件が見つかりませんでした'
      });
    }

    const firstProperty = properties[0];
    if (!firstProperty.sales_assignee || firstProperty.sales_assignee.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '物件担当者が設定されていません'
      });
    }

    const assigneeName = firstProperty.sales_assignee;

    const { StaffManagementService } = require('../services/StaffManagementService');
    const staffService = new StaffManagementService();
    const webhookResult = await staffService.getWebhookUrl(assigneeName);

    if (!webhookResult.success) {
      return res.status(404).json({
        success: false,
        error: webhookResult.error || '担当者のWebhook URLが取得できませんでした'
      });
    }

    const webhookUrl = webhookResult.webhookUrl;

    const price = firstProperty.price || firstProperty.sales_price || firstProperty.listing_price;
    const priceFormatted = price
      ? `${(price / 10000).toLocaleString()}万円`
      : '未設定';

    const detailUrl = buyerDetailUrl || `https://www.appsheet.com/start/8f0d5296-d256-411a-9a64-a13f2e034d8f#view=%E8%B2%B7%E4%B8%BB%E3%83%AA%E3%82%B9%E3%83%88_Detail&row=${buyer.buyer_number}`;

    let message = `問合せありました: \n　【初動担当】${buyer.initial_assignee || '未設定'}【連絡先】${buyer.assignee_phone || '未設定'}\n【物件所在地】 ${firstProperty.display_address || firstProperty.address || '未設定'}\n【価格】${priceFormatted}\n【★問合せ内容】${confirmationText}\n 【問合せ者氏名】${buyer.name || '未設定'}`;

    if (buyer.company_name && buyer.company_name.trim().length > 0) {
      message += `\n【法人の場合法人名】${buyer.company_name}`;
      if (buyer.broker_inquiry && buyer.broker_inquiry.trim().length > 0) {
        message += `\n【仲介の有無】${buyer.broker_inquiry}`;
      }
    }

    message += `\n【問合せ者電話番号】 ${buyer.phone_number || '未設定'}\n${detailUrl}`;

    const { GoogleChatService } = require('../services/GoogleChatService');
    const chatService = new GoogleChatService();
    const sendResult = await chatService.sendMessage(webhookUrl, message);

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: sendResult.error || 'メッセージの送信に失敗しました'
      });
    }

    res.json({
      success: true,
      message: '送信しました'
    });

  } catch (error: any) {
    console.error('[POST /buyers/:buyer_number/send-confirmation] Exception:', error);
    res.status(500).json({
      success: false,
      error: `メッセージの送信に失敗しました: ${error.message}`
    });
  }
});

'''

# export default router; の直前に挿入
insert_pos = text.rfind('\nexport default router;')
if insert_pos == -1:
    print('ERROR: Could not find export default router;')
    exit(1)

new_text = text[:insert_pos] + new_endpoint + text[insert_pos:]

with open('backend/src/routes/buyers.ts', 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('Done! send-confirmation endpoint added to buyers.ts')
