import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TateuriPriceCheckService } from '../../../src/services/TateuriPriceCheckService';

/**
 * 建売専門HP掲載物件の価格変動チェック（Vercel Cron Job用）
 * 
 * Vercel Cron Jobs設定:
 * vercel.json に以下を追加:
 * {
 *   "crons": [{
 *     "path": "/api/tateuri/cron/price-check",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 * 
 * スケジュール: 毎日午前0時（UTC）
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Vercel Cronからのリクエストのみ許可（一時的に無効化してテスト）
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // 認証チェック（テスト時は無効化可能）
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron TateuriPriceCheck] 認証失敗');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron TateuriPriceCheck] 価格チェックジョブ開始');

    const service = new TateuriPriceCheckService();
    const result = await service.checkPrices();

    console.log(`[Cron TateuriPriceCheck] 完了: チェック=${result.checked}件, 変動=${result.changed}件, エラー=${result.errors}件`);
    
    return res.status(200).json({ 
      success: true, 
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[Cron TateuriPriceCheck] エラー:', err.message);
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Vercel Function設定
export const config = {
  maxDuration: 300, // 5分
};