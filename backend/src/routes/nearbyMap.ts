import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// 施設カテゴリの定義
const PLACE_CATEGORIES = [
  { type: 'supermarket', label: 'スーパー', icon: '🛒' },
  { type: 'convenience_store', label: 'コンビニ', icon: '🏪' },
  { type: 'school', label: '小学校・中学校', icon: '🏫' },
  { type: 'kindergarten', label: '幼稚園・保育園', icon: '🎒' },
  { type: 'hospital', label: '病院・クリニック', icon: '🏥' },
  { type: 'pharmacy', label: '薬局', icon: '💊' },
  { type: 'bank', label: '銀行', icon: '🏦' },
  { type: 'post_office', label: '郵便局', icon: '📮' },
  { type: 'park', label: '公園', icon: '🌳' },
  { type: 'restaurant', label: 'レストラン', icon: '🍽️' },
  { type: 'train_station', label: '駅', icon: '🚉' },
  { type: 'bus_station', label: 'バス停', icon: '🚌' },
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

          if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
            results[category.type] = (response.data.results || [])
              .slice(0, 5)
              .map((place: any) => ({
                name: place.name,
                vicinity: place.vicinity,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                rating: place.rating,
                distance: calcDistance(latNum, lngNum, place.geometry?.location?.lat, place.geometry?.location?.lng),
              }))
              .sort((a: any, b: any) => a.distance - b.distance);
          } else {
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

/**
 * OpenAI DALL-E で近隣環境の分かりやすいイラスト画像を生成
 * POST /api/nearby-map/generate-image
 */
router.post('/generate-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { address, places, propertyType } = req.body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI APIキーが設定されていません' });
    }

    // 近隣施設のサマリーを作成
    const facilitySummary = buildFacilitySummary(places);

    // DALL-E 3 でイラスト生成
    const prompt = buildImagePrompt(address, facilitySummary, propertyType);

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'url',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const imageUrl = response.data.data?.[0]?.url;
    if (!imageUrl) {
      return res.status(500).json({ error: '画像URLの取得に失敗しました' });
    }

    return res.json({ imageUrl, prompt });
  } catch (error: any) {
    console.error('[nearbyMap generate-image] Error:', error.response?.data || error.message);
    const status = error.response?.status;
    if (status === 401) {
      return res.status(401).json({ error: 'OpenAI APIキーが無効です' });
    }
    return res.status(500).json({ error: '画像生成に失敗しました' });
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
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** 近隣施設のサマリー文字列を生成 */
function buildFacilitySummary(places: Record<string, any[]>): string {
  const lines: string[] = [];
  const labelMap: Record<string, string> = {
    supermarket: 'スーパー',
    convenience_store: 'コンビニ',
    school: '学校',
    kindergarten: '幼稚園・保育園',
    hospital: '病院',
    pharmacy: '薬局',
    bank: '銀行',
    post_office: '郵便局',
    park: '公園',
    restaurant: 'レストラン',
    train_station: '駅',
    bus_station: 'バス停',
  };

  for (const [type, items] of Object.entries(places)) {
    if (items && items.length > 0) {
      const names = items
        .slice(0, 3)
        .map((p: any) => `${p.name}(${p.distance}m)`)
        .join('、');
      lines.push(`${labelMap[type] || type}: ${names}`);
    }
  }
  return lines.join('\n');
}

/** DALL-E 用プロンプトを生成 */
function buildImagePrompt(address: string, facilitySummary: string, propertyType?: string): string {
  return `
日本の不動産物件の近隣環境マップのイラストを作成してください。

物件情報:
- 住所: ${address || '日本の住宅地'}
- 物件種別: ${propertyType || '住宅'}

近隣施設:
${facilitySummary || 'スーパー、学校、公園、病院などが徒歩圏内にあります'}

スタイル要件:
- 明るく親しみやすいイラスト風マップ
- 俯瞰（鳥瞰図）スタイル
- 物件を中心に半径2km圏内の施設をアイコンで表示
- 各施設に日本語ラベルを付ける
- 道路、緑地、建物を色分けして分かりやすく表示
- 清潔感のある明るいカラーパレット（青・緑・オレンジ系）
- A4印刷に適したレイアウト
- 凡例（legend）を右下に配置
`.trim();
}

export default router;
