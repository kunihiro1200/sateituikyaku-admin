import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from '../services/GeocodingService';
import { randomBytes } from 'crypto';
import axios from 'axios';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/tateuri - 建売物件一覧取得（公開・認証不要）
// クエリパラメータ: ?region=oita（デフォルト）または ?region=fukuoka
router.get('/', async (req: Request, res: Response) => {
  try {
    const region = (req.query.region as string) || 'oita';
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('property_previews')
      .select('slug, title, price, address, access, layout, area, images, lat, lng, created_at')
      .eq('is_tateuri', true)
      .eq('is_active', true)
      .eq('region', region)
      .order('created_at', { ascending: false }); // 新しい順

    if (error) throw error;

    // 不正座標の物件を住所からジオコーディングして補正
    // regionに応じて有効座標範囲を切り替え
    const getValidCoordRange = (r: string) => {
      if (r === 'fukuoka') {
        // 福岡県の範囲
        return { latMin: 33.0, latMax: 34.3, lngMin: 129.5, lngMax: 131.2 };
      }
      // 大分県の範囲（デフォルト）
      return { latMin: 32.5, latMax: 34.0, lngMin: 130.5, lngMax: 132.5 };
    };
    const coordRange = getValidCoordRange(region);
    const isValidCoordForRegion = (lat: number | null, lng: number | null): boolean => {
      if (lat == null || lng == null) return false;
      if (lat < coordRange.latMin || lat > coordRange.latMax || lng < coordRange.lngMin || lng > coordRange.lngMax) return false;
      const latStr = lat.toString();
      const lngStr = lng.toString();
      if (/\.\d*(\d)\1{4,}/.test(latStr)) return false;
      if (/\.\d*(\d)\1{4,}/.test(lngStr)) return false;
      return true;
    };

    const geocodingService = new GeocodingService();
    const supabase2 = getSupabase();
    const enriched = await Promise.all((data || []).map(async (p: any) => {
      if (!isValidCoordForRegion(p.lat, p.lng)) {
        if (!p.address) return { ...p, lat: null, lng: null };
        try {
          const coords = await geocodingService.geocodeAddress(p.address);
          if (coords && isValidCoordForRegion(coords.lat, coords.lng)) {
            console.log(`[tateuri/${region}] Geocoded "${p.address}": (${coords.lat}, ${coords.lng})`);
            // DBにも正しい座標を保存
            await supabase2.from('property_previews')
              .update({ lat: coords.lat, lng: coords.lng })
              .eq('slug', p.slug);
            return { ...p, lat: coords.lat, lng: coords.lng };
          }
        } catch (e) {
          console.error(`[tateuri/${region}] Geocoding failed for "${p.address}":`, e);
        }
        return { ...p, lat: null, lng: null };
      }
      return p;
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('[tateuri] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tateuri/check-duplicate - URLが既に登録済みか確認（認証不要）
router.post('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const { source_url, region = 'oita' } = req.body;
    if (!source_url) {
      return res.status(400).json({ error: 'source_url is required' });
    }

    const supabase = getSupabase();

    // URLを正規化（クエリパラメータを除去して比較）
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, '') + '/';
      } catch {
        return url;
      }
    };

    const normalized = normalizeUrl(source_url);

    // 同じsource_urlで is_active = true のレコードが存在するか確認
    const { data, error } = await supabase
      .from('property_previews')
      .select('slug, title, address, created_at')
      .like('source_url', `${normalized}%`)
      .eq('is_tateuri', true)
      .eq('region', region)
      .eq('is_active', true);

    if (error) throw error;

    if (data && data.length > 0) {
      // 重複あり
      const existing = data[0];
      const cleanTitle = (existing.title || '').replace(/\[\d+\].+$/, '').trim();
      return res.json({
        isDuplicate: true,
        existing: {
          slug: existing.slug,
          title: cleanTitle,
          address: existing.address,
          created_at: existing.created_at,
        },
      });
    }

    // 重複なし
    return res.json({ isDuplicate: false });
  } catch (err: any) {
    console.error('[tateuri] check-duplicate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tateuri/delete - URLで物件を削除（認証不要）
// source_url（元のathome等のURL）またはpreview URL（/property-preview/:slug）で削除可能
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { source_url } = req.body;
    if (!source_url) {
      return res.status(400).json({ error: 'source_url is required' });
    }

    const supabase = getSupabase();

    // プレビューURL（/property-preview/:slug）からslugを抽出
    const slugMatch = source_url.match(/\/property-preview\/([a-f0-9]{12})/);
    if (slugMatch) {
      const slug = slugMatch[1];
      const { data, error } = await supabase
        .from('property_previews')
        .update({ is_active: false })
        .eq('slug', slug)
        .select('slug, title');

      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: '該当する物件が見つかりません' });
      }
      return res.json({ success: true, deleted: data });
    }

    // URLを正規化（クエリパラメータを除去して比較）
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, '') + '/';
      } catch {
        return url;
      }
    };

    const normalized = normalizeUrl(source_url);

    // source_urlが一致するものを非アクティブ化（is_tateuriに関わらず削除）
    const { data, error } = await supabase
      .from('property_previews')
      .update({ is_active: false })
      .like('source_url', `${normalized}%`)
      .select('slug, title');

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: '該当する物件が見つかりません' });
    }

    res.json({ success: true, deleted: data });
  } catch (err: any) {
    console.error('[tateuri] DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tateuri/scrape - スクレイピングサーバーを経由して物件情報を取得・保存（認証不要）
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { url, region = 'oita', processImages = false } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // URLに応じて処理を分岐
    if (url.includes('suumo.jp')) {
      // SUUMOの場合はバックエンド内で直接処理（スクレイピングサーバーを使わない）
      console.log('[tateuri/scrape] SUUMO URLを検出、バックエンド内で処理します');
      return await scrapeSuumoAndSave(url, region, res);
    }

    // athomeの場合はスクレイピングサーバーに転送（既存の動作を維持）
    console.log('[tateuri/scrape] athome URLを検出、スクレイピングサーバーに転送します');
    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';

    // スクレイピングサーバーにリクエスト（バックエンド経由でCORSを回避）
    // processImages=trueの場合、画像加工を指示
    const scrapeRes = await fetch(`${scrapeApiUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, is_tateuri: true, region, process_images: processImages }),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text();
      console.error('[tateuri/scrape] スクレイピングサーバーエラー:', scrapeRes.status, errText);
      return res.status(scrapeRes.status).json({ error: `スクレイピングサーバーエラー: ${scrapeRes.status}` });
    }

    const result = await scrapeRes.json() as any;

    // スクレイピング成功後、regionとis_tateuriをDBに反映（スクレイピングサーバーはこれらを知らないため）
    if (result.success && result.slug) {
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from('property_previews')
        .update({ region, is_tateuri: true })
        .eq('slug', result.slug);
      
      if (updateError) {
        console.error(`[tateuri/scrape] 更新エラー: slug=${result.slug}`, updateError);
      } else {
        console.log(`[tateuri/scrape] region='${region}', is_tateuri=true をslug=${result.slug}に設定`);
      }
    }

    return res.json(result);
  } catch (err: any) {
    console.error('[tateuri/scrape] エラー:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// SUUMOページをスクレイピングしてDBに保存する
async function scrapeSuumoAndSave(url: string, region: string, res: Response) {
  try {
    console.log(`[suumo/scrape] 開始: ${url}`);

    // URLから物件番号を抽出（nc_XXXXXXXX）
    const ncMatch = url.match(/nc_(\d+)/);
    const propertyNumber = ncMatch ? ncMatch[1] : null;
    console.log(`[suumo/scrape] 物件番号: ${propertyNumber}`);

    // SUUMOのHTMLを取得
    const htmlRes = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://suumo.jp/',
      },
      timeout: 30000,
      responseType: 'text',
    });

    const html: string = htmlRes.data;

    // タグを除去してテキストを取得するヘルパー
    const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // --- タイトル ---
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : null;
    if (title) {
      title = title
        .replace(/【[^】]+】/g, '')
        .replace(/\s*[-|｜].*$/, '')
        .trim();
    }

    // --- 物件概要テーブルから各フィールドを抽出するヘルパー ---
    // SUUMOの物件概要は <th>ラベル</th><td>値</td> 形式
    const extractField = (label: string): string | null => {
      // ラベルを含むth〜次のtdを探す
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        escaped + '[\\s\\S]{0,200}?<\\/th>[\\s\\S]{0,50}?<td[^>]*>([\\s\\S]{1,300}?)<\\/td>',
        'i'
      );
      const m = html.match(pattern);
      if (!m) return null;
      const text = stripTags(m[1])
        .replace(/ヒント/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return text || null;
    };

    // --- 価格 ---
    let price = extractField('価格');
    // 「支払シミュレーション」以降を除去
    if (price) price = price.replace(/支払.*$/, '').replace(/□.*$/, '').trim();
    // フォールバック: 「万円」パターン
    if (!price) {
      const m = html.match(/(\d{3,5}万円(?:[～〜]\d{3,5}万円)?)/);
      if (m) price = m[1];
    }

    // --- 住所 ---
    // SUUMOは「所在地」ラベルの後に住所が来る（thではなくdtの場合もある）
    let address = extractField('所在地');
    if (!address) {
      // 「所在地\n\t\t\t\t\t\t\t\t\t\t福岡県...」パターン
      const m = html.match(/所在地\s*<\/[^>]+>\s*([\s\S]{1,200}?)(?:<\/td>|<\/dd>|\[)/);
      if (m) address = stripTags(m[1]).replace(/\[.*?\]/g, '').trim();
    }
    // カーナビ住所をフォールバックに
    if (!address) {
      const m = html.match(/カーナビご利用の方\s*<\/[^>]+>\s*([^\n<]{5,80})/);
      if (m) address = m[1].trim();
    }

    // --- 間取り ---
    let layout = extractField('間取り');
    if (layout) {
      // 「4LDK」のみ抽出
      const lm = layout.match(/[1-9][SLDK+]+/);
      if (lm) layout = lm[0];
    }

    // --- 建物面積 ---
    let area = extractField('建物面積');
    if (area) {
      // 「101.01m2～102.26m2（30.55坪～30.93坪）」→ 最初の面積のみ、スペース除去
      area = area.replace(/\s+/g, '');
      const am = area.match(/[\d.]+m2[^（(]*/);
      if (am) area = am[0].trim();
    }

    // --- 交通 ---
    let access = extractField('交通');
    if (access) {
      // 「乗り換え案内」以降を除去、最初の路線のみ
      access = access.replace(/\[.*?\]/g, '').replace(/乗り換え案内.*$/, '').trim();
      // 長すぎる場合は最初の80文字
      if (access.length > 80) access = access.substring(0, 80) + '...';
    }
    // フォールバック: 交通情報を別パターンで取得
    if (!access) {
      // 「地下鉄〇〇線」「西鉄〇〇」「JR〇〇」パターン
      const trainMatch = html.match(/((?:地下鉄|西鉄|JR|東急|京急|阪急|近鉄)[^\n<「」]{5,60}(?:分|歩\d+分))/);
      if (trainMatch) access = trainMatch[1].trim();
    }

    // --- アピールコメント（特徴ピックアップ） ---
    let appeal_comment: string | null = null;
    
    // パターン1: 「特徴ピックアップ」セクションを取得
    const pickupMatch = html.match(/特徴ピックアップ[\s\S]{0,100}?<[^>]*>([\s\S]{50,2000}?)<\/(?:p|div|dd)>/i);
    if (pickupMatch) {
      appeal_comment = stripTags(pickupMatch[1])
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // パターン2: 「担当者より」セクション
    if (!appeal_comment) {
      const appealM = html.match(/担当者より[\s\S]{0,500}?<p[^>]*>([\s\S]{20,500}?)<\/p>/i);
      if (appealM) {
        appeal_comment = stripTags(appealM[1]).trim();
      }
    }
    
    // パターン3: 「この物件について」
    if (!appeal_comment) {
      const m2 = html.match(/【この物件について】\s*([^<【]{10,300})/);
      if (m2) appeal_comment = m2[1].trim();
    }

    // --- 提供元情報（会社名・電話番号） ---
    let provider_name: string | null = null;
    let provider_phone: string | null = null;

    // パターン1: 「お問い合わせ先」セクションから取得
    const contactMatch = html.match(/お問い?合わ?せ先[\s\S]{0,500}?<\/(?:th|dt)>[\s\S]{0,100}?<(?:td|dd)[^>]*>([\s\S]{10,500}?)<\/(?:td|dd)>/i);
    if (contactMatch) {
      const contactText = stripTags(contactMatch[1]);
      
      // 会社名を抽出（(株)、株式会社、有限会社などを含む）
      const companyMatch = contactText.match(/([（(]株[）)]|株式会社|有限会社|合同会社|[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店))[^\n\r]{0,50}/);
      if (companyMatch) {
        provider_name = companyMatch[0].trim();
      }
      
      // 電話番号を抽出（TEL: 092-XXX-XXXX形式）
      const phoneMatch = contactText.match(/TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i);
      if (phoneMatch) {
        provider_phone = phoneMatch[1].replace(/\s+/g, '').trim();
      }
    }

    // パターン2: HTMLから直接会社名を探す（より広範囲）
    if (!provider_name) {
      const companyPatterns = [
        /([（(]株[）)]|株式会社|有限会社|合同会社)\s*[ァ-ヶー\w]+/,
        /[ァ-ヶー]+(?:不動産|ハウス|ホーム|建設|工務店|住宅)/,
      ];
      for (const pattern of companyPatterns) {
        const match = html.match(pattern);
        if (match) {
          provider_name = match[0].trim();
          break;
        }
      }
    }

    // パターン3: HTMLから直接電話番号を探す
    if (!provider_phone) {
      const phonePatterns = [
        /TEL\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /電話\s*[:：]?\s*(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{4})/i,
        /\b(0\d{1,4}[-]\d{1,4}[-]\d{4})\b/,
      ];
      for (const pattern of phonePatterns) {
        const match = html.match(pattern);
        if (match) {
          provider_phone = match[1].replace(/\s+/g, '').trim();
          break;
        }
      }
    }

    console.log(`[suumo/scrape] 提供元情報: name=${provider_name}, phone=${provider_phone}`);

    // --- 緯度経度 ---
    // SUUMOは地図データをJSに埋め込む。複数パターンを試みる
    let lat: number | null = null;
    let lng: number | null = null;

    // パターン1: lat/lng キーワード
    const latKw = html.match(/['"_]lat['"_\s:=]+([3][0-9]\.[0-9]{4,})/i);
    const lngKw = html.match(/['"_]lng['"_\s:=]+([1][2-4][0-9]\.[0-9]{4,})/i);
    if (latKw) lat = parseFloat(latKw[1]);
    if (lngKw) lng = parseFloat(lngKw[1]);

    // パターン2: 数値パターン（小数点以下6桁以上）
    if (!lat || !lng) {
      const latNums = [...html.matchAll(/\b([3][0-9]\.[0-9]{6,})\b/g)].map(m => parseFloat(m[1]));
      const lngNums = [...html.matchAll(/\b(1[2-4][0-9]\.[0-9]{6,})\b/g)].map(m => parseFloat(m[1]));
      if (latNums.length > 0) lat = latNums[0];
      if (lngNums.length > 0) lng = lngNums[0];
    }

    // パターン3: data-lat / data-lng 属性
    if (!lat || !lng) {
      const dataLat = html.match(/data-lat[='":\s]+([3][0-9]\.[0-9]{4,})/i);
      const dataLng = html.match(/data-lng[='":\s]+([1][2-4][0-9]\.[0-9]{4,})/i);
      if (dataLat) lat = parseFloat(dataLat[1]);
      if (dataLng) lng = parseFloat(dataLng[1]);
    }

    console.log(`[suumo/scrape] 座標: lat=${lat}, lng=${lng}`);

    // --- 画像 ---
    // HTMLから画像URLを抽出
    const images: string[] = [];
    
    // パターン1: img01.suumo.com の resizeImage URL（URLエンコードされたまま使用）
    const resizeImageMatches = html.matchAll(/https:\/\/img01\.suumo\.com\/jj\/resizeImage\?src=gazo%2Fbukken%2F[^"'\s<>]+?\.jpg[^"'\s<>]*/gi);
    for (const match of resizeImageMatches) {
      let imgUrl = match[0];
      
      // HTMLエンティティをデコード（&amp; → &）
      imgUrl = imgUrl.replace(/&amp;/g, '&');
      
      // サイズパラメータを削除して元の画像を取得（より高解像度）
      // 例: &w=96&h=72 → 削除
      imgUrl = imgUrl.replace(/&w=\d+&h=\d+/g, '');
      imgUrl = imgUrl.replace(/&w=\d+/g, '');
      imgUrl = imgUrl.replace(/&h=\d+/g, '');
      
      // 会社ロゴを除外（gazo/kaisha/）
      if (!imgUrl.includes('kaisha') && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }
    
    // パターン2: data-src属性から取得（遅延読み込み画像）
    const dataSrcMatches = html.matchAll(/data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
    for (const match of dataSrcMatches) {
      let imgUrl = match[1];
      // 相対URLの場合は絶対URLに変換
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        imgUrl = 'https://suumo.jp' + imgUrl;
      }
      
      // 除外する画像（明らかに不要なもの）
      const shouldExclude = 
        imgUrl.includes('/icon/') ||
        imgUrl.includes('/logo') ||
        imgUrl.includes('/banner') ||
        imgUrl.includes('/btn_') ||
        imgUrl.includes('/common/') ||
        imgUrl.includes('/edit/assets/') ||
        imgUrl.includes('/edit/include/') ||
        imgUrl.includes('/pagetop') ||
        imgUrl.includes('_logo') ||
        imgUrl.includes('_icon') ||
        imgUrl.includes('_btn') ||
        imgUrl.match(/\d+x\d+\.(jpg|png)/); // サイズ指定の小さい画像
      
      if (!images.includes(imgUrl) && imgUrl.includes('suumo') && !shouldExclude) {
        images.push(imgUrl);
      }
    }

    // パターン3: src属性から取得（通常の画像）
    const srcMatches = html.matchAll(/src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi);
    for (const match of srcMatches) {
      let imgUrl = match[1];
      // 相対URLの場合は絶対URLに変換
      if (imgUrl.startsWith('//')) {
        imgUrl = 'https:' + imgUrl;
      } else if (imgUrl.startsWith('/')) {
        imgUrl = 'https://suumo.jp' + imgUrl;
      }
      
      // 除外する画像
      const shouldExclude = 
        imgUrl.includes('/icon/') ||
        imgUrl.includes('/logo') ||
        imgUrl.includes('/banner') ||
        imgUrl.includes('/btn_') ||
        imgUrl.includes('/common/') ||
        imgUrl.includes('/edit/assets/') ||
        imgUrl.includes('/edit/include/') ||
        imgUrl.includes('/pagetop') ||
        imgUrl.includes('_logo') ||
        imgUrl.includes('_icon') ||
        imgUrl.includes('_btn') ||
        imgUrl.match(/\d+x\d+\.(jpg|png)/);
      
      if (!images.includes(imgUrl) && imgUrl.includes('suumo') && !shouldExclude) {
        images.push(imgUrl);
      }
    }

    // パターン4: 物件番号から画像URLを構築（フォールバック）
    if (images.length === 0 && propertyNumber) {
      const rn = propertyNumber.substring(0, 2);
      for (let i = 1; i <= 15; i++) {
        images.push(
          `https://img.suumo.com/jj/bukken/ichiran/JJ010FJ001.jpg?ar=011&bs=011&rn=${rn}&pn=${propertyNumber}&sp=0&no=${i}&ts=1`
        );
      }
    }

    console.log(`[suumo/scrape] 画像URL抽出: ${images.length}枚`);

    // --- DBに保存 ---
    const supabase = getSupabase();
    const slug = randomBytes(6).toString('hex');

    const payload = {
      slug,
      source_url: url,
      title,
      price,
      address,
      access,
      layout,
      area,
      images,
      lat,
      lng,
      appeal_comment,
      provider_name,
      provider_phone,
      is_tateuri: true,
      is_active: true,
      region,
    };

    console.log(`[suumo/scrape] 保存データ: title=${title}, price=${price}, address=${address}, layout=${layout}, area=${area}`);

    const { error: insertError } = await supabase
      .from('property_previews')
      .insert(payload);

    if (insertError) {
      console.error('[suumo/scrape] DB保存エラー:', insertError);
      return res.status(500).json({ success: false, error: insertError.message });
    }

    console.log(`[suumo/scrape] 保存完了: slug=${slug}, region=${region}`);

    return res.json({
      success: true,
      slug,
      data: payload,
      preview_url: `https://sateituikyaku-admin-frontend.vercel.app/property-preview/${slug}`,
    });

  } catch (err: any) {
    console.error('[suumo/scrape] エラー:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/tateuri/test/send-notification - メール通知テスト用エンドポイント
router.get('/test/send-notification', async (req: Request, res: Response) => {
  try {
    console.log('[Test] メール通知テスト開始');

    const { TateuriPriceCheckService } = await import('../services/TateuriPriceCheckService');
    const service = new (TateuriPriceCheckService as any)();

    // テスト用のダミーデータ
    const testPriceDowns = [{
      slug: '021cb17e0b31',
      title: 'セキュレ南田江（分譲地）',
      address: '大分市南田江',
      oldPrice: '2,800万円',
      newPrice: '2,500万円',
      source_url: 'https://www.athome.co.jp/kodate/3918864382/',
    }];

    const testSoldOuts = [{
      slug: 'test-sold',
      title: 'テスト物件（売却済み）',
      address: '大分市テスト',
      price: '3,000万円',
      source_url: 'https://example.com/test',
    }];

    // メール送信（privateメソッドを直接呼び出せないため、リフレクションを使用）
    await (service as any).sendNotification(testPriceDowns, testSoldOuts);

    console.log('[Test] メール通知テスト完了');
    return res.json({
      success: true,
      message: 'テストメールを送信しました。tenant@ifoo-oita.com を確認してください。',
      priceDowns: testPriceDowns.length,
      soldOuts: testSoldOuts.length,
    });
  } catch (err: any) {
    console.error('[Test] メール通知テストエラー:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tateuri/cron/price-check - 建売物件の価格変動チェック（Vercel Cron Job用）
router.get('/cron/price-check', async (req: Request, res: Response) => {
  try {
    console.log('[Cron TateuriPriceCheck] 価格チェックジョブ開始');

    // 超軽量テスト：環境変数のみ確認
    const quickTest = req.query.quick === 'true';
    if (quickTest) {
      return res.json({
        success: true,
        message: 'クイックテスト完了',
        environment: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
          SCRAPE_API_URL: process.env.SCRAPE_API_URL || 'デフォルト値使用',
          TATEURI_NOTIFY_EMAIL: process.env.TATEURI_NOTIFY_EMAIL || 'デフォルト値使用',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // テスト用：件数制限パラメータ
    const limit = parseInt(req.query.limit as string) || 0; // 0 = 全件
    const testMode = req.query.test === 'true'; // テストモード（スクレイピングなし）
    console.log(`[Cron TateuriPriceCheck] 処理制限: ${limit === 0 ? '全件' : `${limit}件`}, テストモード: ${testMode}`);

    if (testMode) {
      // テストモード：データベースから物件情報のみ取得（スクレイピングなし）
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

      // まず件数のみ取得（高速）
      const { count, error: countError } = await supabase
        .from('property_previews')
        .select('*', { count: 'exact', head: true })
        .eq('is_tateuri', true)
        .eq('is_active', true);

      if (countError) {
        throw countError;
      }

      // 件数が多い場合は詳細データを取得しない
      if (count && count > 50 && !limit) {
        return res.json({
          success: true,
          testMode: true,
          totalCount: count,
          message: `物件数が多いため詳細データをスキップ: ${count}件`,
          recommendation: 'limit パラメータを使用してください（例: ?test=true&limit=10）',
          timestamp: new Date().toISOString(),
        });
      }

      const query = supabase
        .from('property_previews')
        .select('slug, title, price, address, source_url')
        .eq('is_tateuri', true)
        .eq('is_active', true);

      if (limit > 0) {
        query.limit(limit);
      }

      const { data: properties, error } = await query;

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        testMode: true,
        totalCount: count,
        checked: properties?.length || 0,
        changed: 0,
        errors: 0,
        sampleProperties: properties?.slice(0, 3) || [], // 最初の3件のみ表示
        message: `テストモード: ${properties?.length || 0}件の物件情報を取得`,
        timestamp: new Date().toISOString(),
      });
    }

    // 通常モード（スクレイピングあり）
    const { TateuriPriceCheckService } = await import('../services/TateuriPriceCheckService');
    const service = new TateuriPriceCheckService();
    
    // テスト用：制限付きでチェック実行
    const result = limit > 0 
      ? await service.checkPricesLimited(limit)
      : await service.checkPrices();

    console.log(`[Cron TateuriPriceCheck] 完了: チェック=${result.checked}件, 変動=${result.changed}件, エラー=${result.errors}件`);
    return res.status(200).json({ 
      success: true, 
      ...result,
      timestamp: new Date().toISOString(),
      limitApplied: limit > 0 ? limit : null
    });
  } catch (err: any) {
    console.error('[Cron TateuriPriceCheck] エラー:', err.message);
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
