import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// 施設カテゴリの定義
const PLACE_CATEGORIES = [
  { type: 'supermarket',       label: 'スーパー',       icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ',       icon: '🏪' },
  { type: 'school',            label: '小学校・中学校', icon: '🏫' },
  { type: 'kindergarten',      label: '幼稚園・保育園', icon: '🎒' },
  { type: 'hospital',          label: '病院・クリニック', icon: '🏥' },
  { type: 'pharmacy',          label: '薬局',           icon: '💊' },
  { type: 'bank',              label: '銀行',           icon: '🏦' },
  { type: 'post_office',       label: '郵便局',         icon: '📮' },
  { type: 'park',              label: '公園',           icon: '🌳' },
  { type: 'restaurant',        label: 'レストラン',     icon: '🍽️' },
  { type: 'train_station',     label: '駅',             icon: '🚉' },
  { type: 'bus_station',       label: 'バス停',         icon: '🚌' },
];

/**
 * 近隣施設を取得するエンドポイント
 * GET /api/nearby-map/places?lat=33.28&lng=131.48&radius=2000
 */
router.get('/places', authenticate, async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '2000' } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps APIキーが設定されていません' });
    }

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    const radiusNum = parseInt(radius as string, 10);

    // 各カテゴリの施設を並列取得（最大5件ずつ）
    const results: Record<string, any[]> = {};

    await Promise.all(
      PLACE_CATEGORIES.map(async (category) => {
        try {
          const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            {
              params: {
                location: `${latNum},${lngNum}`,
                radius: radiusNum,
                type: category.type,
                language: 'ja',
                key: apiKey,
              },
              timeout: 10000,
            }
          );

          if (
            response.data.status === 'OK' ||
            response.data.status === 'ZERO_RESULTS'
          ) {
            results[category.type] = (response.data.results || [])
              .slice(0, 5)
              .map((place: any) => ({
                name: place.name,
                vicinity: place.vicinity,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                rating: place.rating,
                distance: calcDistance(
                  latNum,
                  lngNum,
                  place.geometry?.location?.lat,
                  place.geometry?.location?.lng
                ),
              }))
              .sort((a: any, b: any) => a.distance - b.distance);
          } else {
            console.warn(
              `[nearbyMap] ${category.type}: status=${response.data.status}`
            );
            results[category.type] = [];
          }
        } catch (err) {
          console.error(`[nearbyMap] Failed to fetch ${category.type}:`, err);
          results[category.type] = [];
        }
      })
    );

    return res.json({
      center: { lat: latNum, lng: lngNum },
      radius: radiusNum,
      categories: PLACE_CATEGORIES,
      places: results,
    });
  } catch (error: any) {
    console.error('[nearbyMap] Error:', error.message);
    return res.status(500).json({ error: '近隣施設の取得に失敗しました' });
  }
});

// ---- ヘルパー関数 ----

/** 2点間の距離をメートルで計算（Haversine公式） */
function calcDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!lat2 || !lng2) return 9999;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default router;
