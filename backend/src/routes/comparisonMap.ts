/**
 * 比較マップ API
 * - POST /api/comparison-maps/geocode       住所から座標を取得
 * - GET  /api/comparison-maps/static-map    Google Maps Static API プロキシ（base64返却）
 * - POST /api/comparison-maps/save          比較マップを保存
 * - GET  /api/comparison-maps/seller/:id    売主の比較マップ一覧
 * - GET  /api/comparison-maps/:mapId        比較マップを取得
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// ── 住所ジオコーディング ──────────────────────────────────────────
/**
 * POST /api/comparison-maps/geocode
 * body: { address: string, name?: string }
 */
router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { address, name } = req.body as { address?: string; name?: string };
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, error: '住所を入力してください。' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GOOGLE_MAPS_API_KEY が未設定です。' });
    }

    const geocodeResp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: address.trim(),
        key: apiKey,
        language: 'ja',
        region: 'jp',
      },
      timeout: 10000,
    });

    if (geocodeResp.data.status !== 'OK' || !geocodeResp.data.results?.length) {
      return res.json({
        success: false,
        error: `座標を取得できませんでした（${geocodeResp.data.status}）。住所を確認してください。`,
      });
    }

    const result = geocodeResp.data.results[0];
    const { lat, lng } = result.geometry.location;
    const accuracy: string = result.geometry.location_type ?? 'UNKNOWN';
    const needsConfirmation = accuracy !== 'ROOFTOP';

    return res.json({
      success: true,
      latitude: lat,
      longitude: lng,
      placeId: result.place_id ?? null,
      formattedAddress: result.formatted_address ?? '',
      accuracy,
      needsConfirmation,
      message: needsConfirmation
        ? `精度: ${accuracy}。地図上で実際の建物位置を確認してください。`
        : null,
    });
  } catch (err: any) {
    console.error('[ComparisonMap] geocode error:', err?.message);
    return res.status(500).json({ success: false, error: 'ジオコーディングに失敗しました。' });
  }
});

// ── Google Maps Static API プロキシ ──────────────────────────────
/**
 * GET /api/comparison-maps/static-map
 * query: markers (JSON string), centerLat, centerLng, zoom, width, height
 */
router.get('/static-map', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY が未設定です。' });
    }

    const { markers: markersParam, centerLat, centerLng, zoom, width = '600', height = '380' } = req.query as Record<string, string>;

    if (!markersParam) {
      return res.status(400).json({ error: 'markers パラメータが必要です。' });
    }

    type MarkerItem = { lat: number; lng: number; label: string; color: string };
    let markers: MarkerItem[];
    try {
      markers = JSON.parse(markersParam);
    } catch {
      return res.status(400).json({ error: 'markers の JSON が不正です。' });
    }

    if (!markers.length) {
      return res.status(400).json({ error: 'マーカーが1件以上必要です。' });
    }

    // URLパラメータを構築（URLSearchParams は repeated keys を扱えないため手動）
    const params: string[] = [
      `size=${width}x${height}`,
      'scale=2',
      'maptype=roadmap',
      'language=ja',
      `key=${apiKey}`,
    ];

    // center / zoom を明示指定（ラベル位置計算のため）
    if (centerLat && centerLng && zoom) {
      params.push(`center=${centerLat},${centerLng}`);
      params.push(`zoom=${zoom}`);
    }

    // マーカーを追加
    for (const m of markers) {
      params.push(`markers=color:${m.color}|size:large|label:${m.label}|${m.lat},${m.lng}`);
    }

    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;

    const imgResp = await axios.get(staticMapUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    const base64 = Buffer.from(imgResp.data as ArrayBuffer).toString('base64');
    const contentType = (imgResp.headers['content-type'] as string | undefined) || 'image/png';

    return res.json({
      imageData: `data:${contentType};base64,${base64}`,
      width: parseInt(width) * 2,   // scale=2 なので実際のピクセル数は2倍
      height: parseInt(height) * 2,
      centerLat: parseFloat(centerLat ?? '0'),
      centerLng: parseFloat(centerLng ?? '0'),
      zoom: parseInt(zoom ?? '14'),
    });
  } catch (err: any) {
    console.error('[ComparisonMap] static-map error:', err?.message);
    return res.status(500).json({ error: '地図画像の取得に失敗しました。' });
  }
});

// ── 比較マップ保存 ──────────────────────────────────────────────
/**
 * POST /api/comparison-maps/save
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { sellerId, sellerNumber, mapTitle, subjectProperty, competingProperties, createdBy } = req.body;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('comparison_maps')
      .insert({
        seller_id: sellerId || null,
        seller_number: sellerNumber || null,
        map_title: mapTitle || null,
        subject_property: subjectProperty ?? {},
        competing_properties: competingProperties ?? [],
        created_by: createdBy || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ComparisonMap] save error:', error);
      return res.status(500).json({ error: '保存に失敗しました。' });
    }

    return res.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('[ComparisonMap] save error:', err?.message);
    return res.status(500).json({ error: '保存に失敗しました。' });
  }
});

// ── 売主の比較マップ一覧取得 ────────────────────────────────────
/**
 * GET /api/comparison-maps/seller/:sellerId
 */
router.get('/seller/:sellerId', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('comparison_maps')
      .select('id, map_title, created_at, subject_property, competing_properties')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: '取得に失敗しました。' });
  }
});

// ── 比較マップ取得（ID指定） ───────────────────────────────────
/**
 * GET /api/comparison-maps/:mapId
 */
router.get('/:mapId', async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('comparison_maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (error || !data) return res.status(404).json({ error: '比較マップが見つかりません。' });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: '取得に失敗しました。' });
  }
});

export default router;
