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

    // ドメイン・会社情報判定（region で切り替え）
    const isFukuoka = data.region === 'fukuoka';
    const domain = isFukuoka ? 'https://fukuoka-tateuri.com' : 'https://oita-tateuri.com';
    const listingPath = isFukuoka ? '/fukuoka-tateuri' : '/tateuri';
    const companyInfo = isFukuoka
      ? { name: '株式会社くじら不動産', phone: '092-401-5331', address: '舞鶴3－1－10', city: '福岡市中央区', pref: '福岡県' }
      : { name: '株式会社いふう', phone: '097-533-2022', address: '舞鶴町1-3-30 STビル１F', city: '大分市', pref: '大分県' };

    const canonicalUrl = `${domain}/property-preview/${slug}`;
    const ogImage = (data.images && data.images[0]) ? data.images[0] : '';

    // titleタグ用
    const titleParts: string[] = [];
    if (cleanTitle) titleParts.push(cleanTitle);
    if (cleanPrice) titleParts.push(cleanPrice);
    if (data.address) titleParts.push(data.address);
    const pageTitle = titleParts.length > 0
      ? `${titleParts.join(' | ')} | ${companyInfo.name}`
      : `物件情報 | ${companyInfo.name}`;

    // descriptionタグ用
    const descParts: string[] = [];
    if (cleanTitle) descParts.push(cleanTitle);
    if (cleanPrice) descParts.push(`価格：${cleanPrice}`);
    if (data.address) descParts.push(`所在地：${data.address}`);
    if (data.access) descParts.push(`交通：${data.access}`);
    if (data.layout) descParts.push(`間取り：${data.layout}`);
    if (data.area) descParts.push(`面積：${data.area}`);
    const description = descParts.length > 0
      ? `${descParts.join('　')}。${companyInfo.name}（${companyInfo.phone}）にお問い合わせください。`
      : `${companyInfo.name}の物件情報です。お気軽にお問い合わせください。`;

    // JSON-LD構造化データ
    const structuredData: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: cleanTitle || '物件情報',
      description,
      url: canonicalUrl,
      seller: {
        '@type': 'RealEstateAgent',
        name: companyInfo.name,
        telephone: companyInfo.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: companyInfo.address,
          addressLocality: companyInfo.city,
          addressRegion: companyInfo.pref,
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

    // サイト名
    const siteName = isFukuoka ? `福岡の建売専門サイト｜${companyInfo.name}` : `大分の建売専門サイト｜${companyInfo.name}`;

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
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ''}
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;

    // Googlebot向け内部リンクブロック（クロールバジェット最適化・ページ間リンク確立）
    const internalLinksBlock = `
    <nav aria-label="サイトナビゲーション" style="font-family:sans-serif;padding:12px 16px;background:#1565c0;color:#fff;">
      <a href="${escapeHtml(domain + listingPath)}" style="color:#fff;text-decoration:none;font-weight:bold;">
        ← ${escapeHtml(isFukuoka ? '福岡の新築建売物件一覧に戻る' : '大分の新築建売物件一覧に戻る')}
      </a>
    </nav>
    <article style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:20px 16px;">
      <h1 style="font-size:1.4em;color:#1a237e;">${escapeHtml(cleanTitle || '物件情報')}</h1>
      ${cleanPrice ? `<p><strong>価格：</strong>${escapeHtml(cleanPrice)}</p>` : ''}
      ${data.address ? `<p><strong>所在地：</strong>${escapeHtml(data.address)}</p>` : ''}
      ${data.access ? `<p><strong>交通：</strong>${escapeHtml(data.access)}</p>` : ''}
      ${data.layout ? `<p><strong>間取り：</strong>${escapeHtml(data.layout)}</p>` : ''}
      ${data.area ? `<p><strong>面積：</strong>${escapeHtml(data.area)}</p>` : ''}
      ${ogImage ? `<img src="${escapeHtml(ogImage)}" alt="${escapeHtml(cleanTitle || '物件外観')}" style="max-width:100%;height:auto;border-radius:4px;" loading="lazy" />` : ''}
      <p style="margin-top:16px;">
        <strong>${escapeHtml(companyInfo.name)}</strong>
        ／ TEL: <a href="tel:${escapeHtml(companyInfo.phone.replace(/-/g,''))}" style="color:#1565c0;">${escapeHtml(companyInfo.phone)}</a>
      </p>
      <p style="margin-top:8px;">
        <a href="${escapeHtml(domain + listingPath)}" style="color:#1565c0;">物件一覧ページへ</a>
      </p>
    </article>`;

    // 既存の<title>タグを置換し、メタタグを<head>の先頭に挿入
    // さらにbody先頭に内部リンクブロックを追加（クロールバジェット最適化）
    html = html
      .replace(/<title>.*?<\/title>/s, '')
      .replace(/<head>/, `<head>${metaTags}`)
      .replace(/<body([^>]*)>/, `<body$1>${internalLinksBlock}`);

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
