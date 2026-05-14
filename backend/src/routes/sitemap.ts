import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/sitemap.xml - サイトマップ生成（認証不要・公開）
// リクエスト元のHostヘッダーに応じて、大分用・福岡用を出し分ける
router.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    console.log('[Sitemap] サイトマップ生成開始');

    // リクエスト元ドメインを判定
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const isFukuoka = host.includes('fukuoka-tateuri.com');

    console.log(`[Sitemap] Host: ${host}, isFukuoka: ${isFukuoka}`);

    const supabase = getSupabase();
    const now = new Date().toISOString();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    if (isFukuoka) {
      // ── 福岡専用サイトマップ ──
      const { data: fukuokaProperties, error: fukuokaError } = await supabase
        .from('property_previews')
        .select('slug, created_at, updated_at')
        .eq('is_tateuri', true)
        .eq('is_active', true)
        .eq('region', 'fukuoka')
        .order('created_at', { ascending: false });

      if (fukuokaError) throw fukuokaError;

      // 福岡トップページ
      xml += '  <url>\n';
      xml += '    <loc>https://fukuoka-tateuri.com/</loc>\n';
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // 福岡の各物件ページ
      for (const property of fukuokaProperties || []) {
        const lastmod = property.updated_at || property.created_at || now;
        xml += '  <url>\n';
        xml += `    <loc>https://fukuoka-tateuri.com/property-preview/${property.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }

      console.log(`[Sitemap] 福岡サイトマップ生成完了: ${1 + (fukuokaProperties?.length || 0)}件`);

    } else {
      // ── 大分専用サイトマップ（デフォルト）──
      const { data: oitaProperties, error: oitaError } = await supabase
        .from('property_previews')
        .select('slug, created_at, updated_at')
        .eq('is_tateuri', true)
        .eq('is_active', true)
        .eq('region', 'oita')
        .order('created_at', { ascending: false });

      if (oitaError) throw oitaError;

      // 大分トップページ
      xml += '  <url>\n';
      xml += '    <loc>https://oita-tateuri.com/</loc>\n';
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // 大分の各物件ページ
      for (const property of oitaProperties || []) {
        const lastmod = property.updated_at || property.created_at || now;
        xml += '  <url>\n';
        xml += `    <loc>https://oita-tateuri.com/property-preview/${property.slug}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }

      console.log(`[Sitemap] 大分サイトマップ生成完了: ${1 + (oitaProperties?.length || 0)}件`);
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);

  } catch (err: any) {
    console.error('[Sitemap] エラー:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
