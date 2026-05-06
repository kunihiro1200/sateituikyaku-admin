import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PropertyPriceMonitorService } from '../../src/services/PropertyPriceMonitorService';

/**
 * 毎日実行される価格変動チェックのCron Job
 * 
 * Vercel Cron Jobs設定:
 * vercel.json に以下を追加:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-property-prices",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 * 
 * スケジュール: 毎日午前9時（JST）
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Vercel Cronからのリクエストのみ許可
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[Cron] 認証エラー: 無効なCRON_SECRET');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] 価格変動チェック開始');

    const monitorService = new PropertyPriceMonitorService();

    // 全買主の価格変動をチェック
    const changes = await monitorService.checkAllPriceChanges();

    // 変更があればメール通知
    if (changes.length > 0) {
      await monitorService.sendPriceChangeNotification(changes);
    }

    console.log(`[Cron] 価格変動チェック完了: ${changes.length}件の変更`);

    return res.status(200).json({
      success: true,
      changesCount: changes.length,
      message: `価格変動チェック完了: ${changes.length}件の変更`,
    });
  } catch (error: any) {
    console.error('[Cron] 価格変動チェックエラー:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
