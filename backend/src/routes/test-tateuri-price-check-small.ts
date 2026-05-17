import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * 建売専門HP価格監視の小規模テスト用エンドポイント（認証なし）
 * 最初の10件のみをテスト
 * 
 * 使用方法:
 * GET /api/test/tateuri-price-check-small
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
    console.log('[Test] 建売専門HP価格チェック（小規模テスト）開始');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 最初の10件のみを取得
    const { data: properties, error } = await supabase
      .from('property_previews')
      .select('slug, title, price, address, source_url')
      .eq('is_tateuri', true)
      .eq('is_active', true)
      .not('source_url', 'is', null)
      .neq('source_url', '')
      .limit(10);

    if (error) {
      throw error;
    }

    if (!properties || properties.length === 0) {
      return res.status(200).json({
        success: true,
        checked: 0,
        changed: 0,
        errors: 0,
        message: 'テスト対象物件なし',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[Test] ${properties.length}件をテスト`);

    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';
    const results = [];
    let errors = 0;

    // 1件ずつ順次処理（テスト用）
    for (const property of properties) {
      try {
        console.log(`[Test] チェック中: ${property.slug}`);

        const res = await fetch(`${scrapeApiUrl}/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: property.source_url }),
          signal: AbortSignal.timeout(15000), // 15秒タイムアウト
        });

        const result = {
          slug: property.slug,
          title: property.title,
          currentPrice: property.price,
          sourceUrl: property.source_url,
          status: res.status,
          success: res.ok,
        };

        if (res.ok) {
          const data = await res.json() as { data?: { price?: string; title?: string } };
          result['scrapedPrice'] = data?.data?.price || null;
          result['scrapedTitle'] = data?.data?.title || null;
        } else {
          result['error'] = `HTTP ${res.status}`;
        }

        results.push(result);
      } catch (err: any) {
        console.error(`[Test] エラー ${property.slug}:`, err.message);
        results.push({
          slug: property.slug,
          title: property.title,
          sourceUrl: property.source_url,
          error: err.message,
          success: false,
        });
        errors++;
      }
    }

    console.log(`[Test] 小規模テスト完了: ${properties.length}件, エラー=${errors}件`);

    return res.status(200).json({
      success: true,
      checked: properties.length,
      errors: errors,
      results: results,
      message: `小規模テスト完了: ${properties.length}件チェック, ${errors}件エラー`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Test] 小規模テストエラー:', error);

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