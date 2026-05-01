import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// カテゴリ定義
const PLACE_CATEGORIES = [
  { type: 'supermarket',       label: 'スーパー',           icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ',           icon: '🏪' },
  { type: 'restaurant',        label: '飲食店',             icon: '🍴' },
  { type: 'elementary_school', label: '小学校',             icon: '小' },
  { type: 'middle_school',     label: '中学校',             icon: '中' },
  { type: 'high_school',       label: '高校',               icon: '高' },
  { type: 'hospital',          label: '病院・クリニック',   icon: '病' },
  { type: 'dentist',           label: '歯科',               icon: '歯' },
  { type: 'bank',              label: '銀行・ATM',          icon: '銀' },
  { type: 'post_office',       label: '郵便局',             icon: '📮' },
  { type: 'park',              label: '公園',               icon: '🌳' },
  { type: 'train_station',     label: '駅',                 icon: '🚉' },
  { type: 'kindergarten',      label: '幼稚園・保育園',     icon: '幼' },
  { type: 'cram_school',       label: '塾',                 icon: '塾' },
];

// Google Places APIのtypeマッピング（カスタムtypeをAPIのtypeに変換）
const PLACES_API_TYPE_MAP: Record<string, string> = {
  elementary_school: 'school',
  middle_school: 'school',
  high_school: 'school',
  cram_school: 'school',
};

// カテゴリごとの名前フィルタ（特定カテゴリのみ名前で絞り込む）
const CATEGORY_NAME_FILTERS: Record<string, RegExp> = {
  elementary_school: /小学校/,
  middle_school: /中学校/,
  high_school: /高校|高等学校/,
  cram_school: /塾|学習塾|進学塾|予備校|学院(?!.*小学|.*中学|.*高校|.*大学)/,
};

// カテゴリごとの除外フィルタ（明らかに無関係な施設を除外するブラックリスト方式）
const CATEGORY_EXCLUDE_FILTERS: Record<string, RegExp> = {
  // 幼稚園・保育園：飲食店・小売店・一般企業などを除外
  kindergarten: /弁当|食堂|レストラン|ラーメン|寿司|焼肉|居酒屋|カフェ|コーヒー|ベーカリー|パン|スーパー|コンビニ|ドラッグ|薬局|ホテル|旅館|銀行|郵便|病院|クリニック|整骨|歯科|美容|理容|ガソリン|駐車|不動産|建設|工務|設計|税理|法律|会計|保険|証券|自動車|バイク|自転車|電気|水道|ガス工|米穀|酒|酒屋|肉|魚|八百|青果|花屋|書店|文具|眼鏡|時計|宝飾|靴|衣料|洋服|クリーニング|印刷|広告|運送|倉庫|工場|製造|農業|漁業|林業|鉱業|建材|金属|化学|医療機器|介護|福祉施設(?!.*こども)|老人|高齢|障害|就労|職業|ハローワーク|公共職業/i,
  // 小学校・中学校：学校以外を除外
  school: /弁当|食堂|レストラン|ラーメン|居酒屋|カフェ|コンビニ|ドラッグ|ホテル|旅館|銀行|病院|クリニック|美容|理容|ガソリン|不動産|自動車|バイク|工場|製造/i,
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
          // カスタムtypeはAPIのtypeにマッピング
          const apiType = PLACES_API_TYPE_MAP[category.type] || category.type;

          const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            {
              params: {
                location: `${latNum},${lngNum}`,
                radius: radiusNum,
                type: apiType,
                language: 'ja',
                key: apiKey,
              },
              timeout: 10000,
            }
          );

          if (response.data.status === 'OK' && response.data.results?.length > 0) {
            // 名前フィルタ（小学校・中学校・高校・塾の絞り込み）
            const nameFilter = CATEGORY_NAME_FILTERS[category.type];
            // 除外フィルタ（幼稚園など）
            const excludeFilter = CATEGORY_EXCLUDE_FILTERS[category.type];

            let filtered = response.data.results;
            if (nameFilter) {
              filtered = filtered.filter((p: any) => nameFilter.test(p.name || ''));
            }
            if (excludeFilter) {
              filtered = filtered.filter((p: any) => !excludeFilter.test(p.name || ''));
            }

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
