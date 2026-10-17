/**
 * 比較マップ API
 * - POST /api/comparison-maps/geocode            住所から座標を取得
 * - POST /api/comparison-maps/extract-properties 画像/PDFから競合物件情報をAIで抽出（1〜4件）
 * - GET  /api/comparison-maps/static-map         Google Maps Static API プロキシ（base64返却）
 * - POST /api/comparison-maps/save               比較マップを保存
 * - GET  /api/comparison-maps/seller/:id         売主の比較マップ一覧
 * - GET  /api/comparison-maps/:mapId             比較マップを取得
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// ── 画像/PDF から競合物件情報を AI 抽出 ─────────────────────────
/**
 * POST /api/comparison-maps/extract-properties
 * body: { imageBase64: string, mediaType: string }
 * 1枚の画像・PDFに含まれる物件を最大4件まで一括抽出して返す。
 */
router.post('/extract-properties', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType } = req.body as { imageBase64?: string; mediaType?: string };
    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 と mediaType が必要です。' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY が未設定です。' });
    }

    const client = new Anthropic({ apiKey });

    const prompt = `この画像は不動産の物件資料（チラシ・概要書・スキャン等）です。
画像に含まれる**全ての物件**を識別してください（1枚のスキャンに複数物件が掲載されている場合もあります）。

各物件について以下のJSON形式で抽出してください。
読み取れない項目は空文字にしてください。絶対に推測や補完をしないでください。

{
  "name": "マンション名または物件名",
  "address": "所在地（住所全文）",
  "price": "販売価格（万円単位の数値のみ。例: 4600。記載なければ空文字）",
  "builtYearMonth": "築年月（YYYY年MM月形式に変換。例: 2012年08月。不明は空文字）",
  "exclusiveArea": "専有面積（数値のみ、㎡単位。例: 72.50。不明は空文字）",
  "totalUnits": "総戸数（数値のみ。不明は空文字）",
  "floorInfo": "所在階（例: 10階建7階。不明は空文字）"
}

複数物件がある場合は配列で返す。1件なら1要素の配列。
必ずJSON配列のみを返してください。説明文は不要です。`;

    const isPdf = mediaType === 'application/pdf';
    const contentPart = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: imageBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 } };

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [contentPart, { type: 'text', text: prompt }],
      }],
    });

    const text = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('');

    console.log('[ComparisonMap] Claude extraction response:', text.substring(0, 500));

    // JSON 配列を抽出
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(422).json({ error: '物件情報を読み取れませんでした。鮮明な画像を試してください。' });
    }

    let properties: unknown[];
    try {
      properties = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(422).json({ error: 'AI応答の解析に失敗しました。' });
    }

    if (!Array.isArray(properties) || properties.length === 0) {
      return res.json({ properties: [] });
    }

    // 最大4件に制限し、フィールドを文字列に正規化
    const normalized = properties.slice(0, 4).map((p: any) => ({
      name: String(p.name ?? ''),
      address: String(p.address ?? ''),
      price: String(p.price ?? ''),
      builtYearMonth: String(p.builtYearMonth ?? ''),
      exclusiveArea: String(p.exclusiveArea ?? ''),
      totalUnits: String(p.totalUnits ?? ''),
      floorInfo: String(p.floorInfo ?? ''),
    }));

    return res.json({ properties: normalized });
  } catch (err: any) {
    console.error('[ComparisonMap] extract-properties error:', err?.message);
    return res.status(500).json({ error: '資料の読み取りに失敗しました。' });
  }
});

// ── 近隣の学校を取得（バックエンド経由・Places API） ─────────────
/**
 * GET /api/comparison-maps/nearby-schools?lat=&lng=&radius=
 */
router.get('/nearby-schools', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '1500' } = req.query as Record<string, string>;
    if (!lat || !lng) return res.status(400).json({ error: 'lat, lng が必要です。' });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY が未設定です。' });

    const searchSchools = async (type: string) => {
      const resp = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: { location: `${lat},${lng}`, radius, type, key: apiKey, language: 'ja' },
        timeout: 8000,
      });
      return ((resp.data.results as any[]) ?? []).slice(0, 8).map((r: any) => ({
        name: r.name ?? '',
        lat: r.geometry?.location?.lat ?? 0,
        lng: r.geometry?.location?.lng ?? 0,
      }));
    };

    const [elementary, middle] = await Promise.all([
      searchSchools('primary_school'),
      searchSchools('secondary_school'),
    ]);

    return res.json({
      elementary: elementary.map(s => ({ ...s, schoolType: 'elementary' })),
      middle: middle.map(s => ({ ...s, schoolType: 'middle' })),
    });
  } catch (err: any) {
    console.error('[ComparisonMap] nearby-schools error:', err?.message);
    return res.status(500).json({ error: '学校情報の取得に失敗しました。' });
  }
});

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

    // マーカーを追加（labelが空の場合はlabel:を省略してシンプルピンにする）
    for (const m of markers) {
      const labelPart = m.label ? `|label:${m.label}` : '';
      const sizePart = (m as any).size === 'small' ? '|size:small' : '|size:large';
      params.push(`markers=color:${m.color}${sizePart}${labelPart}|${m.lat},${m.lng}`);
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
 * body に id があれば更新、なければ新規作成。1売主につき1件を維持する。
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { id, sellerId, sellerNumber, mapTitle, subjectProperty, competingProperties, createdBy } = req.body;

    const supabase = getSupabase();

    if (id) {
      // 既存レコードを更新
      const { error } = await supabase
        .from('comparison_maps')
        .update({
          map_title: mapTitle ?? null,
          subject_property: subjectProperty ?? {},
          competing_properties: competingProperties ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      return res.json({ success: true, id });
    }

    // sellerId で既存レコードを検索（同一売主に複数作らない）
    if (sellerId) {
      const { data: existing } = await supabase
        .from('comparison_maps')
        .select('id')
        .eq('seller_id', sellerId)
        .limit(1)
        .single();
      if (existing?.id) {
        await supabase.from('comparison_maps').update({
          map_title: mapTitle ?? null,
          subject_property: subjectProperty ?? {},
          competing_properties: competingProperties ?? [],
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        return res.json({ success: true, id: existing.id });
      }
    }

    // 新規作成
    const { data, error } = await supabase
      .from('comparison_maps')
      .insert({
        seller_id: sellerId ?? null,
        seller_number: sellerNumber ?? null,
        map_title: mapTitle ?? null,
        subject_property: subjectProperty ?? {},
        competing_properties: competingProperties ?? [],
        created_by: createdBy ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
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
