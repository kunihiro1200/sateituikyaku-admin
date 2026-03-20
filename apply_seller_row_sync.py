"""
GAS onEdit用: updateSingleSellerをpublicに変更 + sync.tsにエンドポイント追加
"""
import re

# 1. EnhancedAutoSyncService.ts: updateSingleSellerをpublicに変更
with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

content = content.replace(
    '  private async updateSingleSeller(sellerNumber: string, row: any): Promise<void> {',
    '  public async updateSingleSeller(sellerNumber: string, row: any): Promise<void> {'
)

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ EnhancedAutoSyncService.ts: updateSingleSeller -> public')

# 2. sync.ts: POST /api/sync/seller-row エンドポイントを追加
with open('backend/src/routes/sync.ts', 'rb') as f:
    content = f.read().decode('utf-8')

new_endpoint = '''
/**
 * POST /api/sync/seller-row
 * GAS onEditトリガー用: スプレッドシートの1行分のデータを受け取ってDBを更新
 * 
 * リクエストボディ: スプレッドシートの行データ（カラム名: 値 の形式）
 * 例: { "売主番号": "AA13501", "状況（当社）": "追客中", ... }
 */
router.post('/seller-row', async (req: Request, res: Response) => {
  // CRON_SECRET認証チェック
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const row = req.body;
    const sellerNumber = row['売主番号'];

    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.startsWith('AA')) {
      return res.status(400).json({ success: false, error: '売主番号が不正です' });
    }

    const { getEnhancedAutoSyncService } = await import('../services/EnhancedAutoSyncService');
    const syncService = getEnhancedAutoSyncService();
    await syncService.initialize();

    // DBに売主が存在するか確認
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const { data: existing } = await supabaseClient
      .from('sellers')
      .select('seller_number')
      .eq('seller_number', sellerNumber)
      .single();

    if (existing) {
      // 既存売主を更新
      await syncService.updateSingleSeller(sellerNumber, row);
      console.log(`✅ [seller-row] Updated: ${sellerNumber}`);
      res.json({ success: true, action: 'updated', sellerNumber });
    } else {
      // 新規売主を追加
      await syncService.syncSingleSeller(sellerNumber, row);
      console.log(`✅ [seller-row] Created: ${sellerNumber}`);
      res.json({ success: true, action: 'created', sellerNumber });
    }
  } catch (error: any) {
    console.error('[seller-row] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

'''

# export default router の直前に挿入
content = content.replace(
    'export default router;',
    new_endpoint + 'export default router;'
)

with open('backend/src/routes/sync.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ sync.ts: POST /api/sync/seller-row エンドポイント追加')
print('完了！')
