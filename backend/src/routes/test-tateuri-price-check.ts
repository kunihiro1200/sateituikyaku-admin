import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TateuriPriceCheckService } from '../../src/services/TateuriPriceCheckService';

/**
 * 建売専門HP価格監視のテスト用エンドポイント（認証なし）
 * 
 * 使用方法:
 * GET /api/test/tateuri-price-check
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
    console.log('[Test] 建売専門HP価格チェックテスト開始');

    const service = new TateuriPriceCheckService();
    const result = await service.checkPrices();

    console.log(`[Test] 建売専門HP価格チェックテスト完了: チェック=${result.checked}件, 変動=${result.changed}件, エラー=${result.errors}件`);

    return res.status(200).json({
      success: true,
      ...result,
      message: `建売専門HP価格チェック完了: チェック=${result.checked}件, 変動=${result.changed}件, エラー=${result.errors}件`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Test] 建売専門HP価格チェックテストエラー:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}

// Vercel Function設定
export const config = {
  maxDuration: 300, // 5分
};