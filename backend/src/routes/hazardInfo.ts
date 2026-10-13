/**
 * ハザード情報自動取得API
 * 国土交通省 不動産情報ライブラリ（Reinfolib）から防災情報を取得・保存する
 *
 * 対応データ:
 *   XKT026: 洪水浸水想定区域（想定最大規模）
 *   XKT027: 高潮浸水想定区域
 *   XKT028: 津波浸水想定
 *   XKT029: 土砂災害警戒区域（イエローゾーン・レッドゾーン）
 *   雨水出水（内水氾濫）: Reinfolib未整備のため "unavailable"（自治体確認案内）
 *
 * 認証: REINFOLIB_API_KEY (youtoChiiki.ts と同じキー)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ──────────────────────────────────────────────
// タイル座標変換（youtoChiiki.ts と同じアルゴリズム）
// ──────────────────────────────────────────────

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180.0) / 360.0 * n);
  const latRad = lat * Math.PI / 180.0;
  const y = Math.floor((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n);
  return { x, y, z: zoom };
}

// ──────────────────────────────────────────────
// Point-in-Polygon 判定（Ray casting）
// ──────────────────────────────────────────────

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function featureContainsPoint(feature: any, lat: number, lng: number): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  // GeoJSON座標は [longitude, latitude] の順
  const point: [number, number] = [lng, lat];
  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((poly: [number, number][][]) =>
      pointInPolygon(point, poly[0])
    );
  }
  // LineString は点包含の判定対象外（土砂災害の一部ライン形状）
  return false;
}

// ──────────────────────────────────────────────
// Reinfolib GeoJSON タイル取得ヘルパー
// ──────────────────────────────────────────────

async function fetchGeoJSON(
  apiEndpoint: string,
  tile: { x: number; y: number; z: number },
  apiKey: string
): Promise<any[] | null> {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/${apiEndpoint}` +
    `?response_format=geojson&z=${tile.z}&x=${tile.x}&y=${tile.y}`;
  try {
    const response = await axios.get(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeout: 15000,
      decompress: true,
    });
    return response.data?.features ?? [];
  } catch (err: any) {
    if (err?.response?.status === 404) return [];
    console.error(`[hazardInfo] ${apiEndpoint} z=${tile.z} x=${tile.x} y=${tile.y} error:`,
      err?.message, err?.response?.status);
    return null;
  }
}

// ──────────────────────────────────────────────
// コード → 日本語マッピング
// ──────────────────────────────────────────────

const FLOOD_DEPTH_LABEL: Record<number, string> = {
  1: '0.5m未満',
  2: '0.5m以上3m未満',
  3: '3m以上5m未満',
  4: '5m以上10m未満',
  5: '10m以上20m未満',
  6: '20m以上',
};

const LANDSLIDE_TYPE_LABEL: Record<number, string> = {
  1: '急傾斜地の崩壊',
  2: '土石流',
  3: '地すべり',
};

// ──────────────────────────────────────────────
// ハザード情報型定義
// ──────────────────────────────────────────────

interface HazardResult {
  flood: string | null;
  flood_depth_rank: number | null;
  flood_depth_label: string | null;
  flood_river_name: string | null;
  inland_flood: string;
  storm_surge: string | null;
  storm_surge_depth: string | null;
  tsunami: string | null;
  tsunami_depth: string | null;
  landslide_yellow: string | null;
  landslide_yellow_type: string | null;
  landslide_red: string | null;
  landslide_red_type: string | null;
}

// ──────────────────────────────────────────────
// 座標からハザード情報を一括取得（Reinfolib API 4本並列）
// ──────────────────────────────────────────────

async function fetchAllHazard(lat: number, lng: number, apiKey: string): Promise<HazardResult> {
  const tile15 = latLngToTile(lat, lng, 15);  // zoom=15（最詳細）

  const result: HazardResult = {
    flood: null,
    flood_depth_rank: null,
    flood_depth_label: null,
    flood_river_name: null,
    inland_flood: 'unavailable',  // Reinfolib API 未整備（雨水出水は自治体データ）
    storm_surge: null,
    storm_surge_depth: null,
    tsunami: null,
    tsunami_depth: null,
    landslide_yellow: null,
    landslide_yellow_type: null,
    landslide_red: null,
    landslide_red_type: null,
  };

  // 4つのAPIを並列で取得（レートリミットに注意）
  const [floodFeatures, stormFeatures, tsunamiFeatures, landslideFeatures] = await Promise.all([
    fetchGeoJSON('XKT026', tile15, apiKey),  // 洪水浸水想定区域（想定最大規模）zoom=14-15
    fetchGeoJSON('XKT027', tile15, apiKey),  // 高潮浸水想定区域 zoom=13-15
    fetchGeoJSON('XKT028', tile15, apiKey),  // 津波浸水想定 zoom=14-15
    fetchGeoJSON('XKT029', tile15, apiKey),  // 土砂災害警戒区域 zoom=11-15
  ]);

  // ① 洪水浸水想定区域（XKT026）
  if (floodFeatures === null) {
    result.flood = 'error';
  } else {
    const matched = floodFeatures.filter(f => featureContainsPoint(f, lat, lng));
    if (matched.length > 0) {
      result.flood = 'inside';
      // 最も深い浸水深ランクを採用
      const maxRank = Math.max(
        ...matched.map(f => typeof f.properties?.A31a_205 === 'number' ? f.properties.A31a_205 : 0)
      );
      if (maxRank > 0) {
        result.flood_depth_rank = maxRank;
        result.flood_depth_label = FLOOD_DEPTH_LABEL[maxRank] ?? null;
      }
      result.flood_river_name = matched[0].properties?.A31a_202 ?? null;
    } else {
      result.flood = 'outside';
    }
  }

  // ③ 高潮浸水想定区域（XKT027）
  if (stormFeatures === null) {
    result.storm_surge = 'error';
  } else {
    const matched = stormFeatures.filter(f => featureContainsPoint(f, lat, lng));
    if (matched.length > 0) {
      result.storm_surge = 'inside';
      result.storm_surge_depth = matched[0].properties?.A49_003 ?? null;
    } else {
      result.storm_surge = 'outside';
    }
  }

  // ④ 津波浸水想定（XKT028）
  if (tsunamiFeatures === null) {
    result.tsunami = 'error';
  } else {
    const matched = tsunamiFeatures.filter(f => featureContainsPoint(f, lat, lng));
    if (matched.length > 0) {
      result.tsunami = 'inside';
      result.tsunami_depth = matched[0].properties?.A40_003 ?? null;
    } else {
      result.tsunami = 'outside';
    }
  }

  // ⑤⑥ 土砂災害警戒区域（XKT029）：イエロー・レッド両方
  // A33_002: 1=土砂災害警戒区域（イエローゾーン）, 2=土砂災害特別警戒区域（レッドゾーン）
  // A33_001: 1=急傾斜地の崩壊, 2=土石流, 3=地すべり
  if (landslideFeatures === null) {
    result.landslide_yellow = 'error';
    result.landslide_red = 'error';
  } else {
    const matched = landslideFeatures.filter(f => featureContainsPoint(f, lat, lng));
    const yellowMatched = matched.filter(f => f.properties?.A33_002 === 1);
    const redMatched = matched.filter(f => f.properties?.A33_002 === 2);

    result.landslide_yellow = yellowMatched.length > 0 ? 'inside' : 'outside';
    if (yellowMatched.length > 0) {
      result.landslide_yellow_type = LANDSLIDE_TYPE_LABEL[yellowMatched[0].properties?.A33_001] ?? null;
    }

    result.landslide_red = redMatched.length > 0 ? 'inside' : 'outside';
    if (redMatched.length > 0) {
      result.landslide_red_type = LANDSLIDE_TYPE_LABEL[redMatched[0].properties?.A33_001] ?? null;
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// GET /api/hazard-info/seller/:sellerNumber
// 保存済みハザード情報を返す（なければ null）
// ──────────────────────────────────────────────

router.get('/seller/:sellerNumber', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('seller_hazard_info')
      .select('*')
      .eq('seller_number', sellerNumber)
      .single();

    // PGRST116 = row not found（正常）
    if (error && error.code !== 'PGRST116') {
      console.error('[hazardInfo/GET] supabase error:', error);
      return res.status(500).json({ error: 'ハザード情報の読み込みに失敗しました' });
    }

    return res.json({ data: data ?? null });
  } catch (err: any) {
    console.error('[hazardInfo/GET] error:', err?.message);
    return res.status(500).json({ error: 'ハザード情報の読み込みに失敗しました' });
  }
});

// ──────────────────────────────────────────────
// POST /api/hazard-info/seller/:sellerNumber/fetch
// Reinfolib APIからハザード情報を取得してDBに保存
// ──────────────────────────────────────────────

router.post('/seller/:sellerNumber/fetch', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;

  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'REINFOLIB_API_KEY が設定されていません。環境変数を確認してください。'
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // sellers テーブルから座標を取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('latitude, longitude, property_address')
      .eq('seller_number', sellerNumber)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const lat: number | null = seller.latitude;
    const lng: number | null = seller.longitude;

    if (lat == null || lng == null) {
      return res.status(422).json({
        error: '物件の座標が未設定です。地図セクションで「再ジオコーディング」を実行してから再試行してください。',
        hint: 'property_address から自動設定するには地図セクションを利用してください',
      });
    }

    console.log(`[hazardInfo] fetching for ${sellerNumber} lat=${lat} lng=${lng}`);

    // Reinfolib API でハザード情報を取得
    const hazardResult = await fetchAllHazard(lat, lng, apiKey);

    // DB に upsert 保存
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('seller_hazard_info')
      .upsert(
        {
          seller_number: sellerNumber,
          latitude: lat,
          longitude: lng,
          ...hazardResult,
          fetched_at: now,
          fetch_error: null,
          updated_at: now,
        },
        { onConflict: 'seller_number' }
      );

    if (upsertError) {
      console.error('[hazardInfo/fetch] upsert error:', upsertError);
      return res.status(500).json({ error: 'ハザード情報の保存に失敗しました' });
    }

    // 保存したデータを返す
    const { data: saved } = await supabase
      .from('seller_hazard_info')
      .select('*')
      .eq('seller_number', sellerNumber)
      .single();

    console.log(`[hazardInfo] saved for ${sellerNumber}: flood=${hazardResult.flood} landslide_red=${hazardResult.landslide_red}`);
    return res.json({ success: true, data: saved });

  } catch (err: any) {
    console.error('[hazardInfo/fetch] error:', err?.message);

    // エラーを DB に記録（次回表示時にエラー状態がわかるように）
    try {
      const supabase2 = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      await supabase2.from('seller_hazard_info').upsert(
        {
          seller_number: sellerNumber,
          fetch_error: err?.message ?? '不明なエラー',
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_number' }
      );
    } catch { /* 記録失敗は無視 */ }

    return res.status(500).json({
      error: 'ハザード情報の取得に失敗しました',
      detail: err?.message,
    });
  }
});

// ──────────────────────────────────────────────
// POST /api/hazard-info/bulk-fetch
// 座標が設定されている全売主のハザード情報を一括取得
// 認証: Authorization: Bearer {CRON_SECRET}
// body: { limit?: number, offset?: number, force?: boolean }
//   limit:  取得件数（デフォルト 50、最大 200）
//   offset: 開始位置（デフォルト 0）
//   force:  true=既取得分も再取得、false=未取得のみ（デフォルト false）
// ──────────────────────────────────────────────

router.post('/bulk-fetch', async (req: Request, res: Response) => {
  // CRON_SECRET 認証
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'REINFOLIB_API_KEY が設定されていません' });
  }

  const limit = Math.min(parseInt(String(req.body?.limit ?? 50), 10), 200);
  const offset = parseInt(String(req.body?.offset ?? 0), 10);
  const force: boolean = req.body?.force === true;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // 座標が設定されている削除済みでない売主を取得
    const { data: sellers, error: listError } = await supabase
      .from('sellers')
      .select('seller_number, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .is('deleted_at', null)
      .range(offset, offset + limit - 1);

    if (listError) {
      return res.status(500).json({ error: '売主一覧の取得に失敗しました' });
    }

    let fetched = 0, skipped = 0, failed = 0;

    for (const seller of sellers ?? []) {
      try {
        // force=false の場合、既取得分はスキップ
        if (!force) {
          const { data: existing } = await supabase
            .from('seller_hazard_info')
            .select('fetched_at')
            .eq('seller_number', seller.seller_number)
            .single();
          if (existing?.fetched_at) {
            skipped++;
            continue;
          }
        }

        const hazardResult = await fetchAllHazard(seller.latitude, seller.longitude, apiKey);
        const now = new Date().toISOString();
        await supabase.from('seller_hazard_info').upsert(
          {
            seller_number: seller.seller_number,
            latitude: seller.latitude,
            longitude: seller.longitude,
            ...hazardResult,
            fetched_at: now,
            fetch_error: null,
            updated_at: now,
          },
          { onConflict: 'seller_number' }
        );
        fetched++;

        // レートリミット対策: 600ms 待機
        await new Promise(r => setTimeout(r, 600));

      } catch (err: any) {
        console.error(`[hazardInfo/bulk] ${seller.seller_number} error:`, err?.message);
        failed++;
      }
    }

    const total = sellers?.length ?? 0;
    console.log(`[hazardInfo/bulk] done: fetched=${fetched} skipped=${skipped} failed=${failed} total=${total}`);
    return res.json({ success: true, fetched, skipped, failed, total });

  } catch (err: any) {
    console.error('[hazardInfo/bulk] error:', err?.message);
    return res.status(500).json({ error: '一括取得に失敗しました', detail: err?.message });
  }
});

export default router;
