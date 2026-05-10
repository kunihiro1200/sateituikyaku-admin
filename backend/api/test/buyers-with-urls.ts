import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * athome_urlが設定されている買主を確認するテスト用エンドポイント（認証なし）
 * 
 * 使用方法:
 * GET /api/test/buyers-with-urls
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // athome_urlが設定されている買主を取得
    const { data: buyers, error } = await supabase
      .from('buyers')
      .select('buyer_number, name, athome_url')
      .not('athome_url', 'is', null)
      .neq('athome_url', '');

    if (error) {
      throw error;
    }

    // 全買主数も取得
    const { count: totalBuyers } = await supabase
      .from('buyers')
      .select('*', { count: 'exact', head: true });

    return res.status(200).json({
      success: true,
      totalBuyers: totalBuyers || 0,
      buyersWithUrls: buyers?.length || 0,
      buyers: buyers || [],
      message: `athome_urlが設定されている買主: ${buyers?.length || 0}件 / 全買主: ${totalBuyers || 0}件`,
    });
  } catch (error: any) {
    console.error('[Test] 買主URL確認エラー:', error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}