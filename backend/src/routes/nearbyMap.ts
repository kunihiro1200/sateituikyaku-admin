import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// カテゴリ定義（飲食店・薬局は不要のため削除）
const PLACE_CATEGORIES = [
  { type: 'supermarket',       label: 'スーパー',           icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ',           icon: '🏪' },
  { type: 'school',            label: '小学校・中学校',     icon: '🏫' },
  { type: 'hospital',          label: '病院・クリニック',   icon: '🏥' },
  { type: 'bank',              label: '銀行・ATM',          icon: '🏦' },
  { type: 'post_office',       label: '郵便局',             icon: '📮' },
  { type: 'park',              label: '公園',               icon: '🌳' },
  { type: 'train_station',     label: '駅',                 icon: '🚉' },
  { type: 'kindergarten',      label: '幼稚園・保育園',     icon: '🎒' },
];

// カテゴリごとの名前フィルタ（関係ない施設を除外）
const CATEGORY_NAME_FILTERS: Record<string, RegExp> = {
  // 幼稚園・保育園：名前に関連キーワードが含まれるものだけ通す
  kindergarten: /幼稚園|保育園|保育所|こども園|認定こども園|託児所|ナーサリー|nursery|kindergarten/i,
  // 小学校・中学校：学校名に関連キーワードが含まれるものだけ通す
  school: /小学校|中学校|学校|スクール|school/i,
};

/**
 * 近隣施設を取得するエンドポイント（旧版Places API使用）
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

    const results: Record<string, any[]> = {};

    // 旧版 nearbysearch を並列実行
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

          if (response.data.status === 'OK' && response.data.results?.length > 0) {
            const nameFilter = CATEGORY_NAME_FILTERS[category.type];
            const filtered = nameFilter
              ? response.data.results.filter((p: any) => nameFilter.test(p.name || ''))
              : response.data.results;

            results[category.type] = filtered
              .slice(0, 5)
              .map((p: any) => ({
                name: p.name,
                vicinity: p.vicinity,
                lat: p.geometry?.location?.lat,
                lng: p.geometry?.location?.lng,
                rating: p.rating,
                distance: calcDistance(latNum, lngNum, p.geometry?.location?.lat, p.geometry?.location?.lng),
              }))
              .sort((a: any, b: any) => a.distance - b.distance);
          } else {
            console.log(`[nearbyMap] ${category.type}: status=${response.data.status}, count=${response.data.results?.length ?? 0}`);
            results[category.type] = [];
          }
        } catch (err: any) {
          console.error(`[nearbyMap] ${category.type} failed:`, err.response?.status, err.message);
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

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (!lat2 || !lng2) return 9999;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default router;
