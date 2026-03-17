import re

# propertyListings.tsを読み込む
with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 追加するエンドポイントコード
new_endpoint = '''
// 売買契約完了 Google Chat通知
router.post('/:propertyNumber/notify-contract-completed', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    const { StaffManagementService } = require('../services/StaffManagementService');
    const axios = require('axios');

    const DEFAULT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAAAlknS4P0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=61OklKGHQpRoIFhiI00wGZPmcRHd4oY_BV47uQGMWbg';

    // 物件情報を取得
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: property, error } = await supabase
      .from('property_listings')
      .select('property_number, address, sales_assignee')
      .eq('property_number', propertyNumber)
      .single();

    if (error || !property) {
      res.status(404).json({ error: '物件が見つかりませんでした' });
      return;
    }

    const message = `契約が完了しましたので、ネット非公開お願いします。${property.property_number}\u3000${property.address || ''}よろしくお願いいたします`;

    // 担当者のWebhook URLを取得
    let webhookUrl = DEFAULT_WEBHOOK_URL;
    if (property.sales_assignee) {
      const staffService = new StaffManagementService();
      const result = await staffService.getWebhookUrl(property.sales_assignee);
      if (result.success && result.webhookUrl) {
        webhookUrl = result.webhookUrl;
      }
    }

    // Google Chatに送信
    await axios.post(webhookUrl, { text: message });

    console.log(`[notify-contract-completed] Sent to ${webhookUrl} for ${propertyNumber}`);
    res.json({ success: true, message });
  } catch (error: any) {
    console.error('[notify-contract-completed] Error:', error.message);
    res.status(500).json({ error: error.message || 'チャット送信に失敗しました' });
  }
});

'''

# export default router; の直前に挿入
text = text.replace('\nexport default router;', new_endpoint + '\nexport default router;')

with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Added notify-contract-completed endpoint.')
