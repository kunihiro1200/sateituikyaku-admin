import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

/**
 * カテゴリ定義
 * Places API (New) の includedTypes を使用
 * keyword検索が廃止されたため、Text Search (New) にフォールバック
 */
const PLACE_CATEGORIES = [
  {
    type: 'supermarket',
    label: 'スーパー',
    icon: '🛒',
    includedTypes: ['supermarket', 'grocery_store'],
    textQueries: ['スーパーマーケット', 'イオン', 'マックスバリュ', 'ゆめタウン'],
  },
  {
    type: 'convenience_store',
    label: 'コンビニ',
    icon: '🏪',
    includedTypes: ['convenience_store'],
    textQueries: [],
  },
  {
    type: 'school',
    label: '小学校・中学校',
    icon: '🏫',
    includedTypes: ['primary_school', 'secondary_school', 'school'],
    textQueries: ['小学校', '中学校'],
  },
  {
    type: 'kindergarten',
    label: '幼稚園・保育園',
    icon: '🎒',
    includedTypes: ['preschool', 'child_care_agency'],
    textQueries: ['幼稚園', '保育園', 'こども園'],
  },
  {
    type: 'hospital',
    label: '病院・クリニック',
    icon: '🏥',
    includedTypes: ['hospital', 'doctor', 'medical_clinic', 'clinic'],
    textQueries: ['病院', 'クリニック'],
  },
  {
    type: 'pharmacy',
    label: '薬局・ドラッグストア',
    icon: '💊',
    includedTypes: ['pharmacy', 'drugstore'],
    textQueries: ['薬局', 'ドラッグストア'],
  },
  {
    type: 'bank',
    label: '銀行・ATM',
    icon: '🏦',
    includedTypes: ['bank', 'atm'],
    textQueries: [],
  },
  {
    type: 'post_office',
    label: '郵便局',
    icon: '📮',
    includedTypes: ['post_office'],
    textQueries: ['郵便局'],
  },
  {
    type: 'park',
    label: '公園',
    icon: '🌳',
    includedTypes: ['park'],
    textQueries: [],
  },
  {
    type: 'restaurant',
    label: 'レストラン・飲食',
    icon: '🍽️',
    includedTypes: ['restaurant', 'food'],
    textQueries: [],
  },
  {
    type: 'train_station',
    label: '駅',
    icon: '🚉',
    includedTypes: ['train_station', 'subway_station', 'light_rail_station'],
    textQueries: [],
  },
  {
    type: 'bus_station',
    label: 'バス停',
    icon: '🚌',
    includedTypes: ['bus_station', 'bus_stop'],
    textQueries: ['バス停'],
  },
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

          // Places API (New) - Nearby Search (POST)
          try {
            const response = await axios.post(
              'https://places.googleapis.com/v1/places:searchNearby',
              {
                includedTypes: category.includedTypes,
                maxResultCount: 10,
                locationRestriction: {
                  circle: {
                    center: { latitude: latNum, longitude: lngNum },
                    radius: radiusNum,
                  },
                },
                languageCode: 'ja',
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.types',
                },
                timeout: 10000,
              }
            );

            if (response.data.places && response.data.places.length > 0) {
              places = response.data.places.map((p: any) => ({
                name: p.displayName?.text || '',
                vicinity: p.formattedAddress || '',
                lat: p.location?.latitude,
                lng: p.location?.longitude,
                rating: p.rating,
                distance: calcDistance(latNum, lngNum, p.location?.latitude, p.location?.longitude),
              }));
            }
          } catch (nearbyErr: any) {
            console.warn(`[nearbyMap] Nearby Search failed for ${category.type}:`, nearbyErr.message);
          }

          // 結果が少ない場合、Text Search でキーワード補完
          if (places.length < 3 && category.textQueries.length > 0) {
            for (const query of category.textQueries) {
              try {
                const textRes = await axios.post(
                  'https://places.googleapis.com/v1/places:searchText',
                  {
                    textQuery: query,
                    maxResultCount: 5,
                    locationBias: {
                      circle: {
                        center: { latitude: latNum, longitude: lngNum },
                        radius: radiusNum,
                      },
                    },
                    languageCode: 'ja',
                  },
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Goog-Api-Key': apiKey,
                      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating',
                    },
                    timeout: 10000,
                  }
                );

                if (textRes.data.places && textRes.data.places.length > 0) {
                  const newPlaces = textRes.data.places
                    .map((p: any) => ({
                      name: p.displayName?.text || '',
                      vicinity: p.formattedAddress || '',
                      lat: p.location?.latitude,
                      lng: p.location?.longitude,
                      rating: p.rating,
                      distance: calcDistance(latNum, lngNum, p.location?.latitude, p.location?.longitude),
                    }))
                    // 指定半径内のみ
                    .filter((p: any) => p.distance <= radiusNum);

                  // 重複除去してマージ
                  for (const np of newPlaces) {
                    if (!places.some((ep) => ep.name === np.name)) {
                      places.push(np);
                    }
                  }
                  if (places.length >= 3) break;
                }
              } catch (textErr: any) {
                console.warn(`[nearbyMap] Text Search failed for "${query}":`, textErr.message);
              }
            }
          }

          // 距離ソート・上位5件
          results[category.type] = places
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
