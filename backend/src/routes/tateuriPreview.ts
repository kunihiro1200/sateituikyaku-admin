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
      .order('address', { ascending: true });

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
    const { url, region = 'oita' } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // SUUMOもathomeも同じスクレイピングサーバーに転送（サーバー側でURL判定して分岐）
    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';

    // スクレイピングサーバーにリクエスト（バックエンド経由でCORSを回避）
    const scrapeRes = await fetch(`${scrapeApiUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, is_tateuri: true, region }),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text();
      console.error('[tateuri/scrape] スクレイピングサーバーエラー:', scrapeRes.status, errText);
      return res.status(scrapeRes.status).json({ error: `スクレイピングサーバーエラー: ${scrapeRes.status}` });
    }

    const result = await scrapeRes.json() as any;

    // スクレイピング成功後、regionをDBに反映（スクレイピングサーバーはregionを知らないため）
    if (result.success && result.data?.slug) {
      const supabase = getSupabase();
      await supabase
        .from('property_previews')
        .update({ region })
        .eq('slug', result.data.slug);
      console.log(`[tateuri/scrape] region='${region}' をslug=${result.data.slug}に設定`);
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

    // --- アピールコメント（売主コメント・担当者コメント） ---
    let appeal_comment: string | null = null;
    // 「担当者より」セクションのテキスト
    const appealM = html.match(/担当者より[\s\S]{0,500}?<p[^>]*>([\s\S]{20,500}?)<\/p>/i);
    if (appealM) {
      appeal_comment = stripTags(appealM[1]).trim();
    }
    // フォールバック: 「この物件について」
    if (!appeal_comment) {
      const m2 = html.match(/【この物件について】\s*([^<【]{10,300})/);
      if (m2) appeal_comment = m2[1].trim();
    }

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
    // SUUMOの画像はJSで動的ロードされるため静的HTMLには含まれない
    // 物件番号からSUUMO画像APIのURLを構築する
    const images: string[] = [];
    if (propertyNumber) {
      // SUUMOの画像URL形式: /jj/bukken/ichiran/JJ010FJ001.jpg?ar=011&bs=011&rn=XX&pn=XXXXXXXX&sp=0&no=N
      // rn は物件番号の先頭2桁
      const rn = propertyNumber.substring(0, 2);
      // 最大15枚試みる
      for (let i = 1; i <= 15; i++) {
        images.push(
          `https://img.suumo.com/jj/bukken/ichiran/JJ010FJ001.jpg?ar=011&bs=011&rn=${rn}&pn=${propertyNumber}&sp=0&no=${i}&ts=1`
        );
      }
    }
    console.log(`[suumo/scrape] 画像URL生成: ${images.length}枚`);

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

// GET /api/tateuri/cron/price-check - 建売物件の価格変動チェック（Vercel Cron Job用）
router.get('/cron/price-check', async (req: Request, res: Response) => {
  try {
    console.log('[Cron TateuriPriceCheck] 価格チェックジョブ開始');

    // Vercel Cron Jobの認証チェック（一時的に無効化してテスト）
    // TODO: 動作確認後に認証を再有効化する
    // const authHeader = req.headers.authorization;
    // const cronSecret = process.env.CRON_SECRET;
    // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    //   console.error('[Cron TateuriPriceCheck] 認証失敗');
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }

    const { TateuriPriceCheckService } = await import('../services/TateuriPriceCheckService');
    const service = new TateuriPriceCheckService();
    const result = await service.checkPrices();

    console.log(`[Cron TateuriPriceCheck] 完了: チェック=${result.checked}件, 変動=${result.changed}件, エラー=${result.errors}件`);
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Cron TateuriPriceCheck] エラー:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
