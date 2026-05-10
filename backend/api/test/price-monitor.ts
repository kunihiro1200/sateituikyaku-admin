import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PropertyPriceMonitorService } from '../../src/services/PropertyPriceMonitorService';

/**
 * 価格監視システムのテスト用エンドポイント（認証なし）
 * 
 * 使用方法:
 * GET /api/test/price-monitor
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // テスト用エンドポイントであることを明示
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Test] 価格監視テスト開始');

    const monitorService = new PropertyPriceMonitorService();

    // 全買主の価格変動をチェック
    const changes = await monitorService.checkAllPriceChanges();

    // 変更があればメール通知
    if (changes.length > 0) {
      await monitorService.sendPriceChangeNotification(changes);
    }

    console.log(`[Test] 価格監視テスト完了: ${changes.length}件の変更`);

    return res.status(200).json({
      success: true,
      changesCount: changes.length,
      changes: changes,
      message: `価格監視テスト完了: ${changes.length}件の変更`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Test] 価格監視テストエラー:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}