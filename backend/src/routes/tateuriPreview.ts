import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GeocodingService } from '../services/GeocodingService';

const router = Router();

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

// GET /api/tateuri - 建売物件一覧取得（公開・認証不要）
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('property_previews')
      .select('slug, title, price, address, access, layout, area, images, lat, lng, created_at')
      .eq('is_tateuri', true)
      .eq('is_active', true)
      .order('address', { ascending: true });

    if (error) throw error;

    // 不正座標を検出する（33.3333... のような繰り返しパターン、または大分県範囲外）
    const isValidCoord = (lat: number | null, lng: number | null): boolean => {
      if (lat == null || lng == null) return false;
      // 大分県の範囲チェック
      if (lat < 32.5 || lat > 34.0 || lng < 130.5 || lng > 132.5) return false;
      // 繰り返しパターン検出（小数点以下4桁以上が同じ数字の繰り返し）
      const latStr = lat.toString();
      const lngStr = lng.toString();
      if (/\.\d*(\d)\1{4,}/.test(latStr)) return false;
      if (/\.\d*(\d)\1{4,}/.test(lngStr)) return false;
      return true;
    };

    // 不正座標の物件を住所からジオコーディングして補正
    const geocodingService = new GeocodingService();
    const supabase2 = getSupabase();
    const enriched = await Promise.all((data || []).map(async (p: any) => {
      if (!isValidCoord(p.lat, p.lng)) {
        if (!p.address) return { ...p, lat: null, lng: null };
        try {
          const coords = await geocodingService.geocodeAddress(p.address);
          if (coords && isValidCoord(coords.lat, coords.lng)) {
            console.log(`[tateuri] Geocoded "${p.address}": (${coords.lat}, ${coords.lng})`);
            // DBにも正しい座標を保存
            await supabase2.from('property_previews')
              .update({ lat: coords.lat, lng: coords.lng })
              .eq('slug', p.slug);
            return { ...p, lat: coords.lat, lng: coords.lng };
          }
        } catch (e) {
          console.error(`[tateuri] Geocoding failed for "${p.address}":`, e);
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
