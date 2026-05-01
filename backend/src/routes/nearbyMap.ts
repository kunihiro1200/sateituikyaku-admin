import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

/**
 * カテゴリ定義
 * - googleType: Places API の type パラメータ（公式サポート型）
 * - keywords: 日本語キーワード検索（typeで取れない場合のフォールバック）
 * - useKeyword: true の場合は keyword 検索を優先
 */
const PLACE_CATEGORIES = [
  { type: 'supermarket',       label: 'スーパー',         icon: '🛒', keywords: ['スーパー', 'スーパーマーケット', 'イオン', 'マックスバリュ', 'フレスタ', 'ゆめタウン'], useKeyword: true },
  { type: 'convenience_store', label: 'コンビニ',         icon: '🏪', keywords: ['コンビニ', 'セブンイレブン', 'ローソン', 'ファミリーマート', 'ミニストップ'], useKeyword: false },
  { type: 'school',            label: '小学校・中学校',   icon: '🏫', keywords: ['小学校', '中学校'], useKeyword: true },
  { type: 'kindergarten',      label: '幼稚園・保育園',   icon: '🎒', keywords: ['幼稚園', '保育園', '保育所', 'こども園'], useKeyword: true },
  { type: 'hospital',          label: '病院・クリニック', icon: '🏥', keywords: ['病院', 'クリニック', '診療所', '医院'], useKeyword: true },
  { type: 'pharmacy',          label: '薬局・ドラッグストア', icon: '💊', keywords: ['薬局', 'ドラッグストア', 'マツキヨ', 'ツルハ', 'ウエルシア', 'コスモス'], useKeyword: true },
  { type: 'bank',              label: '銀行・ATM',        icon: '🏦', keywords: ['銀行', 'ATM'], useKeyword: false },
  { type: 'post_office',       label: '郵便局',           icon: '📮', keywords: ['郵便局', '郵便'], useKeyword: true },
  { type: 'park',              label: '公園',             icon: '🌳', keywords: ['公園'], useKeyword: false },
  { type: 'restaurant',        label: 'レストラン・飲食', icon: '🍽️', keywords: ['レストラン', '飲食店'], useKeyword: false },
  { type: 'train_station',     label: '駅',               icon: '🚉', keywords: ['駅'], useKeyword: false },
  { type: 'bus_station',       label: 'バス停',           icon: '🚌', keywords: ['バス停', 'バス乗り場'], useKeyword: true },
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

    const results: Record<string, any[]> = {};

    await Promise.all(
      PLACE_CATEGORIES.map(async (category) => {
        try {
          let places: any[] = [];

          if (category.useKeyword) {
            // keyword検索（日本語キーワードで確実に取得）
            // 複数キーワードを順番に試して最初に結果が出たものを使う
            for (const kw of category.keywords) {
              const response = await axios.get(
                'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
                {
                  params: {
                    location: `${latNum},${lngNum}`,
                    radius: radiusNum,
                    keyword: kw,
                    language: 'ja',
                    key: apiKey,
                  },
                  timeout: 10000,
                }
              );

              if (response.data.status === 'OK' && response.data.results?.length > 0) {
                places = response.data.results;
                break; // 最初に結果が出たキーワードで終了
              }
            }

            // keyword検索で取れなかった場合はtype検索もフォールバック
            if (places.length === 0) {
              const fallback = await axios.get(
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
              if (fallback.data.status === 'OK') {
                places = fallback.data.results || [];
              }
            }
          } else {
            // type検索（コンビニ・銀行・公園・駅など標準typeで確実に取れるもの）
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

            if (response.data.status === 'OK') {
              places = response.data.results || [];
            } else {
              console.warn(`[nearbyMap] ${category.type}: status=${response.data.status}`);
            }
          }

          // 距離計算・ソート・上位5件
          results[category.type] = places
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
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 5);

        } catch (err: any) {
          console.error(`[nearbyMap] Failed to fetch ${category.type}:`, err.message);
          results[category.type] = [];
        }
      })
    );

    return res.json({
      center: { lat: latNum, lng: lngNum },
      radius: radiusNum,
      categories: PLACE_CATEGORIES.map(({ type, label, icon }) => ({ type, label, icon })),
      places: results,
    });
  } catch (error: any) {
    console.error('[nearbyMap] Error:', error.message);
    return res.status(500).json({ error: '近隣施設の取得に失敗しました' });
  }
});

// ---- ヘルパー関数 ----

/** 2点間の距離をメートルで計算（Haversine公式） */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
