import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/property-preview/:slug - 公開プレビュー取得（認証不要）
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('property_previews')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '物件情報が見つかりません' });
    }

    // 期限切れチェック
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ error: 'この物件情報は期限切れです' });
    }

    res.json(data);
  } catch (err: any) {
    console.error('[propertyPreview] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/property-preview-html/:slug - SEO用HTMLを返す（Googleクローラー向け）
// vercel.jsonのrewritesで /property-preview/:slug からこのエンドポイントに転送される
router.get('/html/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('property_previews')
      .select('slug, title, price, address, access, layout, area, images, lat, lng, region')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return res.status(404).send('<html><body><h1>物件情報が見つかりません</h1></body></html>');
    }

    // タイトル・価格のクリーニング
    const cleanTitle = (data.title || '').replace(/\[\d+\].+$/, '').trim();
    const cleanPrice = (data.price || '').replace(/支払額シミュレーション.*$/, '').trim();

    // ドメイン判定（region で切り替え）
    const domain = data.region === 'fukuoka'
      ? 'https://fukuoka-tateuri.com'
      : 'https://oita-tateuri.com';

    const canonicalUrl = `${domain}/property-preview/${slug}`;
    const ogImage = (data.images && data.images[0]) ? data.images[0] : '';

    // titleタグ用
    const titleParts: string[] = [];
    if (cleanTitle) titleParts.push(cleanTitle);
    if (cleanPrice) titleParts.push(cleanPrice);
    if (data.address) titleParts.push(data.address);
    const pageTitle = titleParts.length > 0
      ? `${titleParts.join(' | ')} | 株式会社いふう`
      : '物件情報 | 株式会社いふう';

    // descriptionタグ用
    const descParts: string[] = [];
    if (cleanTitle) descParts.push(cleanTitle);
    if (cleanPrice) descParts.push(`価格：${cleanPrice}`);
    if (data.address) descParts.push(`所在地：${data.address}`);
    if (data.access) descParts.push(`交通：${data.access}`);
    if (data.layout) descParts.push(`間取り：${data.layout}`);
    if (data.area) descParts.push(`面積：${data.area}`);
    const description = descParts.length > 0
      ? `${descParts.join('　')}。株式会社いふう（097-533-2022）にお問い合わせください。`
      : '株式会社いふうの物件情報です。お気軽にお問い合わせください。';

    // JSON-LD構造化データ
    const structuredData: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: cleanTitle || '物件情報',
      description,
      url: canonicalUrl,
      seller: {
        '@type': 'RealEstateAgent',
        name: '株式会社いふう',
        telephone: '097-533-2022',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '舞鶴町1-3-30 STビル１F',
          addressLocality: '大分市',
          addressRegion: '大分県',
          addressCountry: 'JP',
        },
      },
    };
    if (ogImage) structuredData['image'] = ogImage;
    if (cleanPrice) {
      structuredData['offers'] = {
        '@type': 'Offer',
        price: cleanPrice.replace(/[^0-9]/g, ''),
        priceCurrency: 'JPY',
        availability: 'https://schema.org/InStock',
      };
    }
    if (data.address) {
      structuredData['address'] = {
        '@type': 'PostalAddress',
        addressLocality: data.address,
        addressCountry: 'JP',
      };
    }
    if (data.lat && data.lng) {
      structuredData['geo'] = {
        '@type': 'GeoCoordinates',
        latitude: data.lat,
        longitude: data.lng,
      };
    }

    // フロントエンドのindex.htmlを取得してメタタグを差し込む
    // Vercel上ではフロントエンドのURLからindex.htmlを取得
    const frontendUrl = 'https://sateituikyaku-admin-frontend.vercel.app';
    let html: string;

    try {
      const axios = (await import('axios')).default;
      const indexRes = await axios.get(`${frontendUrl}/index.html`, { timeout: 5000 });
      html = indexRes.data as string;
    } catch {
      // フロントエンドのindex.htmlが取得できない場合は最小限のHTMLを返す
      html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body><div id="root"></div></body></html>`;
    }

    // <head>内のデフォルトメタタグを物件専用に差し込む
    const metaTags = `
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
    <meta property="og:site_name" content="福岡の建売専門サイト｜株式会社いふう" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;

    // 既存の<title>タグを置換し、メタタグを<head>の先頭に挿入
    html = html
      .replace(/<title>.*?<\/title>/s, '')
      .replace(/<head>/, `<head>${metaTags}`);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.send(html);

  } catch (err: any) {
    console.error('[propertyPreview] HTML GET error:', err);
    res.status(500).send('<html><body><h1>エラーが発生しました</h1></body></html>');
  }
});

// HTMLエスケープ用ユーティリティ
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default router;
