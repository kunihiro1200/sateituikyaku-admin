# -*- coding: utf-8 -*-
import re

# ファイルを読み取る
with open('backend/src/routes/propertyListings.ts', 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# export default router; の直前にCHAT送信履歴取得APIを追加
api_code = '''
// CHAT送信履歴取得API
router.get('/:propertyNumber/chat-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { propertyNumber } = req.params;
    
    // property_chat_historyテーブルから履歴を取得（新しい順）
    const { data: history, error } = await supabase
      .from('property_chat_history')
      .select('*')
      .eq('property_number', propertyNumber)
      .order('sent_at', { ascending: false });
    
    if (error) {
      console.error('[get-chat-history] Error:', error);
      res.status(500).json({ error: 'CHAT送信履歴の取得に失敗しました' });
      return;
    }
    
    res.json({ history: history || [] });
  } catch (error: any) {
    console.error('[get-chat-history] Error:', error.message);
    res.status(500).json({ error: error.message || 'CHAT送信履歴の取得に失敗しました' });
  }
});

'''

# export default router; の直前に追加
text = text.replace('export default router;', api_code + 'export default router;')

# UTF-8で書き込む
with open('backend/src/routes/propertyListings.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
