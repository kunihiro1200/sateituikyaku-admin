import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';
import { lookupFukuokaSchool } from '../services/FukuokaSchoolAddressService';

// 大分市・別府市住所対応表を静的インポート
import oitaBeppuAddressMapJson from '../data/oita-beppu-school-address-map.json';

// 大分市・別府市住所対応表
let _oitaBeppuAddressMap: any = oitaBeppuAddressMapJson;
function loadOitaBeppuAddressMapInRoute() {
  return _oitaBeppuAddressMap || { records: [] };
}

/**
 * 大分市・別府市の住所から学区を照合する
 * @param address 物件住所（例: "大分市顕徳町1丁目5番", "別府市青山町3番"）
 * @returns { elementary, juniorHigh } | null
 */
function lookupOitaBeppuSchool(address: string): {
  elementary: string;
  juniorHigh: string;
  city: string;
  town: string;
  confidence: 'confirmed' | 'uncertain';
} | null {
  const map = loadOitaBeppuAddressMapInRoute();
  const records = map.records as any[];
  if (!records?.length) return null;

  // 市名を判定
  let city: string | null = null;
  if (address.includes('大分市')) city = '大分市';
  else if (address.includes('別府市')) city = '別府市';
  if (!city) return null;

  // 市名以降の文字列から町名を抽出
  const afterCity = address.split(city)[1] || '';
  if (!afterCity) return null;

  // 全角数字を半角に変換
  const toHalf = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const afterCityNorm = toHalf(afterCity);

  // 町名抽出: 数字・ハイフン・スペースの前まで + 丁目番号も含む
  // 例: "顕徳町1丁目5番" → "顕徳町1丁目" まで取得
  const townWithChomeMatch = afterCityNorm.match(/^([^\d\-\s　]*(?:\d+丁目)?)/);
  const townWithChome = townWithChomeMatch ? townWithChomeMatch[1].replace(/[の\s　]+$/, '').trim() : '';

  // まず完全一致（町名+丁目）
  const cityRecords = records.filter((r: any) => r.city === city);

  // 候補: 完全一致 → 前方一致
  const candidates = [
    ...cityRecords.filter((r: any) => r.town === townWithChome),
    ...cityRecords.filter((r: any) => townWithChome && r.town !== townWithChome && r.town.startsWith(
      townWithChome.replace(/\d+丁目$/, '').trim()  // 丁目なし前方一致
    )),
  ];

  if (!candidates.length) return null;

  // 「の一部」「番を除く」等の例外がある場合は uncertain
  const best = candidates[0];
  const confidence: 'confirmed' | 'uncertain' = best.town.includes('の一部') || best.town.includes('を除く') || best.town.includes('以外')
    ? 'uncertain'
    : 'confirmed';

  return {
    elementary: best.elementary,
    juniorHigh: best.juniorHigh,
    city: best.city,
    town: best.town,
    confidence,
  };
}

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
  { type: 'bus_station',       label: 'バス停',             icon: '🚌' },
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

// 追加検索が必要なカテゴリ（1つのtype検索では漏れる施設を補完する）
// イオン等の大型スーパーはGoogleでshopping_mallに分類されることがあるため追加検索
const EXTRA_SEARCHES: Record<string, { type?: string; keyword: string }[]> = {
  supermarket: [
    { keyword: 'イオン スーパー' },
    { type: 'shopping_mall', keyword: 'イオン' },
  ],
};

// カテゴリごとのkeywordパラメータ（APIレベルで絞り込む）
const PLACES_API_KEYWORD_MAP: Record<string, string> = {
  elementary_school: '小学校',
  middle_school: '中学校',
  high_school: '高校',
  kindergarten: '幼稚園 保育園',
};

// カテゴリごとの名前フィルタ（特定カテゴリのみ名前で絞り込む）
const CATEGORY_NAME_FILTERS: Record<string, RegExp> = {
  elementary_school: /小学校/,
  middle_school: /中学校/,
  high_school: /高校|高等学校/,
  cram_school: /塾|学習塾|進学塾|予備校|学院(?!.*小学|.*中学|.*高校|.*大学)/,
  // 幼稚園・保育園：関連キーワードが含まれるものだけ通す（ホワイトリスト）
  kindergarten: /幼稚園|保育園|保育所|こども園|認定こども園|託児所|ナーサリー|nursery|kindergarten/i,
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
          // keywordパラメータ（APIレベルで絞り込む）
          const apiKeyword = PLACES_API_KEYWORD_MAP[category.type];

          const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            {
              params: {
                location: `${latNum},${lngNum}`,
                radius: radiusNum,
                type: apiType,
                ...(apiKeyword ? { keyword: apiKeyword } : {}),
                language: 'ja',
                key: apiKey,
              },
              timeout: 10000,
            }
          );

          let allResults: any[] = [];
          if (response.data.status === 'OK' && response.data.results?.length > 0) {
            allResults = response.data.results;
          }

          // 追加検索（イオン等の大型スーパーがshopping_mallに分類されるケースに対応）
          const extraSearches = EXTRA_SEARCHES[category.type];
          if (extraSearches) {
            const extraResponses = await Promise.all(
              extraSearches.map((extra) =>
                axios.get(
                  'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
                  {
                    params: {
                      location: `${latNum},${lngNum}`,
                      radius: radiusNum,
                      ...(extra.type ? { type: extra.type } : {}),
                      keyword: extra.keyword,
                      language: 'ja',
                      key: apiKey,
                    },
                    timeout: 10000,
                  }
                ).catch(() => null)
              )
            );
            for (const extraRes of extraResponses) {
              if (extraRes?.data?.status === 'OK' && extraRes.data.results?.length > 0) {
                // place_idで重複排除してマージ
                const existingIds = new Set(allResults.map((p: any) => p.place_id));
                for (const place of extraRes.data.results) {
                  if (!existingIds.has(place.place_id)) {
                    allResults.push(place);
                    existingIds.add(place.place_id);
                  }
                }
              }
            }
          }

          if (allResults.length > 0) {
            // 名前フィルタ（小学校・中学校・高校・塾の絞り込み）
            const nameFilter = CATEGORY_NAME_FILTERS[category.type];
            // 除外フィルタ（幼稚園など）
            const excludeFilter = CATEGORY_EXCLUDE_FILTERS[category.type];

            let filtered = allResults;
            if (nameFilter) {
              filtered = filtered.filter((p: any) => nameFilter.test(p.name || ''));
            }
            if (excludeFilter) {
              filtered = filtered.filter((p: any) => !excludeFilter.test(p.name || ''));
            }

            results[category.type] = filtered
              .map((p: any) => ({
                name: p.name,
                vicinity: p.vicinity,
                lat: p.geometry?.location?.lat,
                lng: p.geometry?.location?.lng,
                rating: p.rating,
                distance: calcDistance(latNum, lngNum, p.geometry?.location?.lat, p.geometry?.location?.lng),
              }))
              .sort((a: any, b: any) => a.distance - b.distance)
              .slice(0, 5);
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

// ---- 小学校区（校区ポリゴン） ----

// GeoJSONデータをロード
// require()を使うことでVercelバンドルに確実に含まれる
let schoolDistrictsData: any = null;
function loadSchoolDistricts() {
  if (schoolDistrictsData) return schoolDistrictsData;
  try {
    schoolDistrictsData = require('../data/school-districts.json');
    console.log(`[nearbyMap] 校区データ読み込み完了: ${schoolDistrictsData.features?.length ?? 0}校区`);
  } catch (err: any) {
    console.warn('[nearbyMap] 校区データの読み込みに失敗:', err.message);
    schoolDistrictsData = { type: 'FeatureCollection', features: [] };
  }
  return schoolDistrictsData;
}

// Point-in-Polygon判定（レイキャスティング法）
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    // GeoJSON座標は [lng, lat] の順
    const xi = polygon[i][1], yi = polygon[i][0];
    const xj = polygon[j][1], yj = polygon[j][0];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 指定座標が属する小学校区を返すエンドポイント
 * GET /api/nearby-map/school-district?lat=33.28&lng=131.48
 * 
 * レスポンス:
 * {
 *   found: true,
 *   district: { name: "○○小学校", adminCode: "44201", polygon: [[lng,lat],...] },
 *   neighbors: [{ name: "△△小学校", polygon: [...] }, ...] // 周辺校区（表示用）
 * }
 */
router.get('/school-district', authenticate, async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);

    const data = loadSchoolDistricts();
    if (!data.features || data.features.length === 0) {
      return res.json({ found: false, district: null, neighbors: [] });
    }

    // 物件座標が属する校区を検索
    let matchedDistrict: any = null;
    for (const feature of data.features) {
      const geomType = feature.geometry?.type;
      if (geomType === 'Polygon') {
        const rings = feature.geometry.coordinates;
        if (!rings || rings.length === 0) continue;
        if (pointInPolygon(latNum, lngNum, rings[0])) {
          matchedDistrict = feature;
          break;
        }
      } else if (geomType === 'MultiPolygon') {
        const polygons = feature.geometry.coordinates;
        for (const rings of polygons) {
          if (rings && rings.length > 0 && pointInPolygon(latNum, lngNum, rings[0])) {
            matchedDistrict = feature;
            break;
          }
        }
        if (matchedDistrict) break;
      }
    }

    // 周辺校区を取得（物件から約3km以内のバウンディングボックスで絞り込み）
    const DELTA = 0.03; // 約3km
    const neighbors: any[] = [];
    for (const feature of data.features) {
      if (feature === matchedDistrict) continue;
      const geomType = feature.geometry?.type;
      let outerRing: [number, number][] | null = null;
      if (geomType === 'Polygon') {
        const rings = feature.geometry.coordinates;
        if (!rings || rings.length === 0) continue;
        outerRing = rings[0];
      } else if (geomType === 'MultiPolygon') {
        const polygons = feature.geometry.coordinates;
        if (!polygons || polygons.length === 0) continue;
        outerRing = polygons[0][0]; // 最初のポリゴンの外側リング
      } else {
        continue;
      }
      if (!outerRing) continue;
      // バウンディングボックスチェック
      const hasNearby = outerRing.some(([pLng, pLat]: [number, number]) =>
        Math.abs(pLat - latNum) < DELTA && Math.abs(pLng - lngNum) < DELTA
      );
      if (hasNearby) {
        neighbors.push({
          name: feature.properties?.name || '',
          adminCode: feature.properties?.adminCode || '',
          polygon: outerRing,
        });
      }
    }

    if (matchedDistrict) {
      const geomType = matchedDistrict.geometry?.type;
      const polygon = geomType === 'MultiPolygon'
        ? matchedDistrict.geometry.coordinates[0][0]
        : matchedDistrict.geometry.coordinates[0];
      return res.json({
        found: true,
        district: {
          name: matchedDistrict.properties?.name || '',
          adminCode: matchedDistrict.properties?.adminCode || '',
          polygon,
        },
        neighbors: neighbors.slice(0, 10), // 最大10校区
      });
    }

    return res.json({ found: false, district: null, neighbors: neighbors.slice(0, 10) });
  } catch (error: any) {
    console.error('[nearbyMap] school-district error:', error.message);
    return res.status(500).json({ error: '校区情報の取得に失敗しました' });
  }
});

// ---- 広告表示用の徒歩時間計算 ----
// 不動産公正競争規約に基づく計算: 80mにつき1分、端数切り上げ
function calcWalkMinutes(distanceMeters: number): number {
  return Math.ceil(distanceMeters / 80);
}

// ---- Directions API で徒歩ルート距離を取得 ----
// 戻り値: { meters: number, isEstimated: boolean }
//   - isEstimated=false: Routes API / Directions API による実測値
//   - isEstimated=true : API 不可時のハーバーサイン直線 × 1.3 推定値
async function fetchWalkingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<{ meters: number; isEstimated: boolean }> {
  // ---- 試み1: Routes API（新版・推奨）----
  try {
    const routesRes = await axios.post(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'WALK',
        computeAlternativeRoutes: false,
      },
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    const meters = routesRes.data?.routes?.[0]?.distanceMeters;
    if (meters) {
      return { meters, isEstimated: false };
    }
  } catch (routesErr: any) {
    const code = routesErr.response?.data?.error?.code || routesErr.response?.status;
    console.warn('[nearbyMap] Routes API failed:', code, routesErr.response?.data?.error?.message || routesErr.message);
  }

  // ---- 試み2: Directions API（旧版） ----
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/directions/json',
      {
        params: {
          origin: `${originLat},${originLng}`,
          destination: `${destLat},${destLng}`,
          mode: 'walking',
          language: 'ja',
          key: apiKey,
        },
        timeout: 10000,
      }
    );
    if (response.data.status === 'OK' && response.data.routes?.[0]?.legs?.[0]) {
      return { meters: response.data.routes[0].legs[0].distance.value, isEstimated: false };
    }
    console.warn('[nearbyMap] Directions API status:', response.data.status);
  } catch (err: any) {
    console.warn('[nearbyMap] Directions API error:', err.message);
  }

  // ---- フォールバック: 直線距離 × 1.3 ----
  const estimatedMeters = Math.round(calcDistance(originLat, originLng, destLat, destLng) * 1.3);
  return { meters: estimatedMeters, isEstimated: true };
}

/**
 * 物件から最寄り小学校・中学校の徒歩ルート距離を取得
 * GET /api/nearby-map/school-walk?lat=X&lng=Y
 *   [&elementaryLat=X&elementaryLng=Y]  : 小学校正門のカスタム座標（省略可）
 *   [&juniorHighLat=X&juniorHighLng=Y]  : 中学校正門のカスタム座標（省略可）
 *
 * レスポンス:
 * {
 *   elementarySchool: {
 *     name: string,           // 学校名
 *     distanceMeters: number, // 道路距離(m)
 *     walkMinutes: number,    // 徒歩時間(分) ※80m/分、端数切り上げ
 *     lat: number,            // 使用した目的地緯度（正門またはPlaces API座標）
 *     lng: number,            // 使用した目的地経度
 *     districtConfirmed: boolean, // true=GeoJSONによる学区判定、false=最近接
 *   } | null,
 *   juniorHighSchool: { ... } | null  // ※中学校区GeoJSONなし、最近接を参考表示
 * }
 *
 * コスト: Google Maps Directions API $0.005/request × 最大2件/呼び出し
 * キャッシュ: 結果はseller_attached_document2に保存（最大30日のキャッシュとして利用規約上許容）
 */
/**
 * XKT005 デバッグ用エンドポイント（認証不要でテスト可能）
 * GET /api/nearby-map/debug-xkt005?lat=X&lng=Y
 */
router.get('/debug-xkt005', authenticate, async (req: Request, res: Response) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: '緯度・経度が必要です' });

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const reinfilibKey = process.env.REINFOLIB_API_KEY;

  if (!reinfilibKey) {
    return res.json({ status: 'NO_KEY', message: 'REINFOLIB_API_KEY が未設定です' });
  }

  const results: any[] = [];

  for (const zoom of [11, 12, 13, 14]) {
    const { x, y } = latLngToTileXY(latNum, lngNum, zoom);
    const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT005?response_format=geojson&z=${zoom}&x=${x}&y=${y}`;

    try {
      const resp = await axios.get(url, {
        headers: { 'Ocp-Apim-Subscription-Key': reinfilibKey },
        timeout: 15000,
      });
      const features: any[] = resp.data?.features ?? [];
      let matched: any = null;

      for (const f of features) {
        const geomType = f.geometry?.type;
        let hit = false;
        if (geomType === 'Polygon') {
          if (f.geometry.coordinates?.[0] && pointInPolygon(latNum, lngNum, f.geometry.coordinates[0])) hit = true;
        } else if (geomType === 'MultiPolygon') {
          for (const rings of f.geometry.coordinates) {
            if (rings?.[0] && pointInPolygon(latNum, lngNum, rings[0])) { hit = true; break; }
          }
        }
        if (hit) { matched = f.properties; break; }
      }

      results.push({
        zoom, x, y, httpStatus: 200,
        featureCount: features.length,
        matched: !!matched,
        schoolName: matched?.A32_004_ja || null,
        adminCode: matched?.A32_001 || null,
        sampleProps: features[0]?.properties ?? null,
      });
    } catch (err: any) {
      results.push({
        zoom, x, y, httpStatus: err.response?.status ?? 'ERROR',
        error: err.message, featureCount: 0, matched: false,
      });
    }
  }

  return res.json({ keySet: true, keyPrefix: reinfilibKey.substring(0, 4) + '...', lat: latNum, lng: lngNum, results });
});

router.get('/school-walk', authenticate, async (req: Request, res: Response) => {
  try {
    const { lat, lng, elementaryLat, elementaryLng, juniorHighLat, juniorHighLng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps APIキーが設定されていません' });
    }

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);

    // ---- 小学校区データのロード ----
    // 優先順位:
    //   1. 福岡市住所対応表（番地レベル・最精確）
    //   2. 福岡市公式GeoJSON（2025/12/26版）
    //   3. 国土数値情報 GeoJSON（全国）
    const inFukuokaArea = lngNum >= 130.0 && lngNum <= 130.5 && latNum >= 33.4 && latNum <= 33.9;
    const propertyAddressParam = (req.query.propertyAddress as string | undefined) || '';

    let elementarySchoolNameFromDistrict: string | null = null;
    let elementaryDistrictSource = 'xkt004';
    let elementaryDistrictDate = '20240401';
    let elementaryConfidence: 'confirmed' | 'uncertain' = 'confirmed';

    // ① 福岡市住所対応表（FukuokaSchoolAddressService を使用・番地/号レベル対応）
    // データ: 562件（全中学校行）、Wayback Machine 2025-04-01 + 現行 hc/mc
    if (inFukuokaArea && propertyAddressParam) {
      try {
        const schoolResult = lookupFukuokaSchool(propertyAddressParam);
        if (schoolResult) {
          // 義務教育学校（elementary="-"）: 中学校名を小学校欄にも表示
          const elem = schoolResult.elementary === '-'
            ? schoolResult.juniorHigh
            : schoolResult.elementary;
          elementarySchoolNameFromDistrict = elem;
          elementaryDistrictSource = 'fukuoka_address_table';
          elementaryDistrictDate   = '20260401';
          elementaryConfidence     = schoolResult.confidence;
          (req as any)._jhFromAddressTable = schoolResult.juniorHigh;
          console.log(`[nearbyMap] 住所対応表ヒット: ${elem} / ${schoolResult.juniorHigh} (${schoolResult.ward} ${schoolResult.town}) [${schoolResult.confidence}]`);
        } else {
          console.log(`[nearbyMap] 住所対応表: ヒットなし → GeoJSONフォールバック (${propertyAddressParam})`);
        }
      } catch (e: any) {
        console.warn('[nearbyMap] 住所対応表照合エラー:', e.message);
      }
    }

    // ② 大分市・別府市住所対応表（property_address がある場合）
    if (!elementarySchoolNameFromDistrict && propertyAddressParam &&
        (propertyAddressParam.includes('大分市') || propertyAddressParam.includes('別府市'))) {
      try {
        const result = lookupOitaBeppuSchool(propertyAddressParam);
        if (result) {
          // 義務教育学校（elementary="-"）: 中学校名を小学校欄にも表示
          const elem = result.elementary === '-'
            ? result.juniorHigh
            : result.elementary;
          elementarySchoolNameFromDistrict = elem;
          elementaryDistrictSource = 'oita_official';
          elementaryDistrictDate = result.city === '大分市' ? '20250401' : '20260401';
          elementaryConfidence = result.confidence;
          (req as any)._jhFromAddressTable = result.juniorHigh;
          console.log(`[nearbyMap] 大分/別府住所対応表ヒット: ${elem} / ${result.juniorHigh} (${result.city} ${result.town}) [${result.confidence}]`);
        }
      } catch (e: any) {
        console.warn('[nearbyMap] 大分/別府住所対応表照合エラー:', e.message);
      }
    }

    // ③ 福岡市公式GeoJSONで判定（住所対応表でヒットしなかった場合）
    if (!elementarySchoolNameFromDistrict && inFukuokaArea) {
      const fukuokaElemData = loadFukuokaElementarySchoolDistricts();
      if (fukuokaElemData.features?.length > 0) {
        for (const feature of fukuokaElemData.features) {
          const geomType = feature.geometry?.type;
          let matched = false;
          if (geomType === 'Polygon') {
            const rings = feature.geometry.coordinates;
            if (rings?.length > 0 && pointInPolygon(latNum, lngNum, rings[0])) matched = true;
          } else if (geomType === 'MultiPolygon') {
            for (const rings of feature.geometry.coordinates) {
              if (rings?.length > 0 && pointInPolygon(latNum, lngNum, rings[0])) { matched = true; break; }
            }
          }
          if (matched) {
            elementarySchoolNameFromDistrict = feature.properties?.name || null;
            elementaryDistrictSource = 'fukuoka_official';
            elementaryDistrictDate = '20251226';
            break;
          }
        }
      }
    }

    // ④ 国土数値情報 GeoJSON（その他またはフォールバック）
    if (!elementarySchoolNameFromDistrict) {
      const districtData = loadSchoolDistricts();
      if (districtData.features?.length > 0) {
        for (const feature of districtData.features) {
          const geomType = feature.geometry?.type;
          let matched = false;
          if (geomType === 'Polygon') {
            const rings = feature.geometry.coordinates;
            if (rings?.length > 0 && pointInPolygon(latNum, lngNum, rings[0])) matched = true;
          } else if (geomType === 'MultiPolygon') {
            for (const rings of feature.geometry.coordinates) {
              if (rings?.length > 0 && pointInPolygon(latNum, lngNum, rings[0])) { matched = true; break; }
            }
          }
          if (matched) {
            elementarySchoolNameFromDistrict = feature.properties?.name || null;
            break;
          }
        }
      }
    }

    // ---- 小学校: Places API で座標取得 ----
    // カスタム正門座標がある場合はそれを優先
    let elementarySchoolResult: {
      name: string; lat: number; lng: number; districtConfirmed: boolean;
    } | null = null;

    const customElemLat = elementaryLat ? parseFloat(elementaryLat as string) : null;
    const customElemLng = elementaryLng ? parseFloat(elementaryLng as string) : null;

    if (customElemLat && customElemLng) {
      // カスタム正門座標が設定済み
      // 住所対応表で確定した学校名がある場合はそちらを優先（座標のみ保持）
      if (elementarySchoolNameFromDistrict) {
        // 住所対応表の結果を使い、座標だけカスタム正門を利用
        elementarySchoolResult = {
          name: elementarySchoolNameFromDistrict,
          lat: customElemLat,
          lng: customElemLng,
          districtConfirmed: true,
        };
      } else {
        // 住所対応表未使用時のみ Nearby Search で名前を取得
        const nearbyRes = await axios.get(
          'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
          {
            params: {
              location: `${customElemLat},${customElemLng}`,
              radius: 200,
              type: 'school',
              keyword: '小学校',
              language: 'ja',
              key: apiKey,
            },
            timeout: 10000,
          }
        );
        const candidates = (nearbyRes.data.results || []).filter((r: any) => /小学校/.test(r.name));
        const schoolName = candidates[0]?.name || '小学校';
        elementarySchoolResult = { name: schoolName, lat: customElemLat, lng: customElemLng, districtConfirmed: false };
      }
    } else if (elementarySchoolNameFromDistrict) {
      // ---- 学区名が確定している場合: Find Place API で名前指定検索（Nearby Searchより精確）----
      // 住所対応表・GeoJSONで確定した学校名を使って座標を取得する。
      // Nearby Searchは最近接校を返すため、境界付近で隣の学校が返ることがある。
      const placeCoords = await findSchoolCoordsByName(elementarySchoolNameFromDistrict, latNum, lngNum, apiKey);
      if (placeCoords) {
        elementarySchoolResult = {
          name: elementarySchoolNameFromDistrict,
          lat: placeCoords.lat,
          lng: placeCoords.lng,
          districtConfirmed: true,
        };
      } else {
        // Find Place にヒットなし → Nearby Search で名前一致を試みる
        const nearbyRes2 = await axios.get(
          'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
          {
            params: {
              location: `${latNum},${lngNum}`,
              radius: 5000,
              type: 'school',
              keyword: '小学校',
              language: 'ja',
              key: apiKey,
            },
            timeout: 10000,
          }
        );
        const candidates2: any[] = (nearbyRes2.data.results || []).filter((r: any) => /小学校/.test(r.name));
        const matched2 = candidates2.find((c: any) =>
          c.name.includes(elementarySchoolNameFromDistrict!) ||
          (elementarySchoolNameFromDistrict!).includes(c.name.replace(/^.*立/, ''))
        );
        if (matched2) {
          elementarySchoolResult = {
            name: matched2.name,
            lat: matched2.geometry.location.lat,
            lng: matched2.geometry.location.lng,
            districtConfirmed: true,
          };
        } else {
          // 座標不明だが学区名は確定
          elementarySchoolResult = {
            name: elementarySchoolNameFromDistrict,
            lat: latNum,
            lng: lngNum,
            districtConfirmed: true,
          };
        }
      }
    } else {
      // ---- 学区名が不明な場合のみ Nearby Search で最近接校を使用 ----
      const nearbyRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        {
          params: {
            location: `${latNum},${lngNum}`,
            radius: 5000,
            type: 'school',
            keyword: '小学校',
            language: 'ja',
            key: apiKey,
          },
          timeout: 10000,
        }
      );
      const candidates: any[] = (nearbyRes.data.results || []).filter((r: any) => /小学校/.test(r.name));
      if (candidates.length > 0) {
        elementarySchoolResult = {
          name: candidates[0].name,
          lat: candidates[0].geometry.location.lat,
          lng: candidates[0].geometry.location.lng,
          districtConfirmed: false,
        };
      }
    }

    // ---- 中学校: 静的GeoJSONファイルで Point-in-Polygon 判定（小学校と同じ方式）----
    // ① 福岡市住所対応表（小学校と同じリクエストで取得済み）
    // XKT005 API・REINFOLIB_API_KEY 不要
    let juniorHighSchoolResult: {
      name: string | null; lat: number | null; lng: number | null; districtConfirmed: boolean;
    } | null = null;

    const customJhLat = juniorHighLat ? parseFloat(juniorHighLat as string) : null;
    const customJhLng = juniorHighLng ? parseFloat(juniorHighLng as string) : null;

    // 住所対応表で中学校も取得（Fukuoka OR 大分市/別府市）
    if (propertyAddressParam) {
      try {
        const jhFromTable: string | undefined = (req as any)._jhFromAddressTable;
        if (jhFromTable) {
          let jhLat = customJhLat;
          let jhLng = customJhLng;
          if (!jhLat || !jhLng) {
            const placeCoords = await findSchoolCoordsByName(jhFromTable, latNum, lngNum, apiKey);
            jhLat = placeCoords?.lat ?? null;
            jhLng = placeCoords?.lng ?? null;
          }
          juniorHighSchoolResult = {
            name: jhFromTable,
            lat: jhLat,
            lng: jhLng,
            districtConfirmed: true,
          };
          console.log(`[nearbyMap] 住所対応表 中学校: ${jhFromTable}`);
        }
      } catch (e: any) {
        console.warn('[nearbyMap] 住所対応表 中学校照合エラー:', e.message);
      }
    }

    // ② フォールバック: 静的GeoJSON Point-in-Polygon
    if (!juniorHighSchoolResult) {
      const jhDistrict = findMiddleSchoolDistrict(latNum, lngNum);

      if (jhDistrict) {
        let jhLat = customJhLat;
        let jhLng = customJhLng;
        if (!jhLat || !jhLng) {
          const placeCoords = await findSchoolCoordsByName(jhDistrict.name, latNum, lngNum, apiKey);
          jhLat = placeCoords?.lat ?? null;
          jhLng = placeCoords?.lng ?? null;
        }
        juniorHighSchoolResult = {
          name: jhDistrict.name,
          lat: jhLat,
          lng: jhLng,
          districtConfirmed: true,
        };
        console.log(`[nearbyMap] 中学校区判定成功: ${jhDistrict.name}`);
      } else {
        juniorHighSchoolResult = { name: null, lat: null, lng: null, districtConfirmed: false };
        console.warn('[nearbyMap] 中学校区: GeoJSONにヒットなし');
      }
    }

    // ---- Directions API で徒歩ルート距離を並列計算 ----
    const [elemResult, jhResult] = await Promise.all([
      elementarySchoolResult
        ? fetchWalkingDistance(latNum, lngNum, elementarySchoolResult.lat, elementarySchoolResult.lng, apiKey)
        : Promise.resolve(null),
      juniorHighSchoolResult
        ? fetchWalkingDistance(latNum, lngNum, juniorHighSchoolResult.lat, juniorHighSchoolResult.lng, apiKey)
        : Promise.resolve(null),
    ]);

    // ---- レスポンス組み立て ----
    const jhDistConfirmed = juniorHighSchoolResult?.districtConfirmed ?? false;
    const jhHasCoords = !!(juniorHighSchoolResult?.lat && juniorHighSchoolResult?.lng);

    return res.json({
      elementarySchool: elementarySchoolResult
        ? {
            name: elementarySchoolResult.name,
            distanceMeters: elemResult?.meters ?? null,
            walkMinutes: elemResult ? calcWalkMinutes(elemResult.meters) : null,
            isEstimated: elemResult?.isEstimated ?? false,
            lat: elementarySchoolResult.lat,
            lng: elementarySchoolResult.lng,
            districtConfirmed: elementarySchoolResult.districtConfirmed,
            dataSource: elementaryDistrictSource,
            dataDate: elementaryDistrictDate,
            confidence: elementaryConfidence,
          }
        : null,
      juniorHighSchool: {
        name: juniorHighSchoolResult?.name ?? null,
        distanceMeters: jhHasCoords ? (jhResult?.meters ?? null) : null,
        walkMinutes: jhHasCoords ? (jhResult ? calcWalkMinutes(jhResult.meters) : null) : null,
        isEstimated: jhHasCoords ? (jhResult?.isEstimated ?? false) : false,
        lat: juniorHighSchoolResult?.lat ?? null,
        lng: juniorHighSchoolResult?.lng ?? null,
        districtConfirmed: jhDistConfirmed,
        notAvailableReason: (!jhDistConfirmed && !juniorHighSchoolResult?.name) ? 'DISTRICT_NOT_FOUND' : null,
      },
    });
  } catch (error: any) {
    console.error('[nearbyMap] school-walk error:', error.message);
    return res.status(500).json({ error: '学校徒歩距離の取得に失敗しました' });
  }
});

// ---- 中学校区（校区ポリゴン）- 小学校区と同じ静的GeoJSON方式 ----

let middleSchoolDistrictsData: any = null;
function loadMiddleSchoolDistricts() {
  if (middleSchoolDistrictsData) return middleSchoolDistrictsData;
  try {
    middleSchoolDistrictsData = require('../data/middle-school-districts.json');
    console.log(`[nearbyMap] 中学校区データ読み込み完了: ${middleSchoolDistrictsData.features?.length ?? 0}校区`);
  } catch (err: any) {
    console.warn('[nearbyMap] 中学校区データの読み込みに失敗:', err.message);
    middleSchoolDistrictsData = { type: 'FeatureCollection', features: [] };
  }
  return middleSchoolDistrictsData;
}

// ---- 福岡市公式中学校区データ（2025/12/26版）----
// 国土数値情報（XKT005）に福岡市のデータが存在しないため、市公式Shapefileから変換
// 出典: https://webmap.city.fukuoka.lg.jp/fukuoka/OpenData
let fukuokaMiddleSchoolData: any = null;
function loadFukuokaMiddleSchoolDistricts() {
  if (fukuokaMiddleSchoolData) return fukuokaMiddleSchoolData;
  try {
    fukuokaMiddleSchoolData = require('../data/fukuoka-middle-school-districts.json');
    console.log(`[nearbyMap] 福岡市中学校区データ読み込み完了: ${fukuokaMiddleSchoolData.features?.length ?? 0}校区`);
  } catch (err: any) {
    console.warn('[nearbyMap] 福岡市中学校区データの読み込みに失敗:', err.message);
    fukuokaMiddleSchoolData = { type: 'FeatureCollection', features: [] };
  }
  return fukuokaMiddleSchoolData;
}

// ---- 福岡市公式小学校区データ（2025/12/26版）----
// 国土数値情報の小学校区より精確な境界を持つ市公式データ
// 出典: https://webmap.city.fukuoka.lg.jp/fukuoka/OpenData opendata_139.zip
let fukuokaElementarySchoolData: any = null;
function loadFukuokaElementarySchoolDistricts() {
  if (fukuokaElementarySchoolData) return fukuokaElementarySchoolData;
  try {
    fukuokaElementarySchoolData = require('../data/fukuoka-elementary-school-districts.json');
    console.log(`[nearbyMap] 福岡市小学校区データ読み込み完了: ${fukuokaElementarySchoolData.features?.length ?? 0}校区`);
  } catch (err: any) {
    console.warn('[nearbyMap] 福岡市小学校区データの読み込みに失敗:', err.message);
    fukuokaElementarySchoolData = { type: 'FeatureCollection', features: [] };
  }
  return fukuokaElementarySchoolData;
}

/**
 * 指定座標が属する中学校区を返す
 * - 福岡市内（lng 130.0-130.5, lat 33.4-33.9）: 福岡市公式データ優先
 * - その他: 国土数値情報（XKT005）から生成したデータを使用
 * - 判定できない場合: null を返す（近隣校で代用しない）
 */
function findMiddleSchoolDistrict(lat: number, lng: number): {
  name: string;
  adminCode: string;
  source: string;
  dataDate: string;
} | null {
  // 福岡市の大まかな範囲チェック（lng 130.0-130.5, lat 33.4-33.9）
  const inFukuokaArea = lng >= 130.0 && lng <= 130.5 && lat >= 33.4 && lat <= 33.9;

  const searchTargets: Array<{ data: any; source: string; dataDate: string }> = [];

  if (inFukuokaArea) {
    // 福岡市エリア: 公式データを最優先
    searchTargets.push({
      data: loadFukuokaMiddleSchoolDistricts(),
      source: 'fukuoka_official',
      dataDate: '20251226',
    });
  }
  // XKT005データ（他エリアまたはフォールバック）
  searchTargets.push({
    data: loadMiddleSchoolDistricts(),
    source: 'xkt005',
    dataDate: '20240401',
  });

  for (const target of searchTargets) {
    const features = target.data?.features ?? [];
    for (const feature of features) {
      const geomType = feature.geometry?.type;
      let matched = false;

      if (geomType === 'Polygon') {
        const rings = feature.geometry.coordinates;
        if (rings?.length > 0 && pointInPolygon(lat, lng, rings[0])) matched = true;
      } else if (geomType === 'MultiPolygon') {
        for (const rings of feature.geometry.coordinates) {
          if (rings?.length > 0 && pointInPolygon(lat, lng, rings[0])) { matched = true; break; }
        }
      }

      if (matched) {
        const name = feature.properties?.name || feature.properties?.A32_004_ja || feature.properties?.A32_002 || null;
        const adminCode = feature.properties?.adminCode || feature.properties?.A32_001 || '';
        if (name) return { name, adminCode, source: target.source, dataDate: target.dataDate };
      }
    }
  }

  return null; // 判定不可（近隣校で代用しない）
}

// ---- XKT005: タイル座標変換 ----
function latLngToTileXY(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180.0) / 360.0 * n);
  const latRad = lat * Math.PI / 180.0;
  const y = Math.floor((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n);
  return { x, y };
}

/**
 * XKT005 API で中学校区を判定する
 * z=11→12→13 の順に試し、タイル境界問題を回避する
 */
async function fetchJuniorHighSchoolDistrict(
  lat: number,
  lng: number,
  reinfilibKey: string
): Promise<{ name: string; adminCode: string } | null> {
  // z=11（市区レベル）から試す → タイル境界で区域が分断されにくい
  const ZOOM_LEVELS = [11, 12, 13, 14];

  for (const ZOOM of ZOOM_LEVELS) {
    const { x, y } = latLngToTileXY(lat, lng, ZOOM);
    const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT005?response_format=geojson&z=${ZOOM}&x=${x}&y=${y}`;

    try {
      const response = await axios.get(url, {
        headers: { 'Ocp-Apim-Subscription-Key': reinfilibKey },
        timeout: 15000,
      });

      const features: any[] = response.data?.features ?? [];
      console.log(`[nearbyMap] XKT005 z=${ZOOM} x=${x} y=${y}: ${features.length}件`);

      if (features.length === 0) continue; // 次のズームへ

      // Point-in-Polygon で物件座標が含まれる校区を検索
      for (const feature of features) {
        const geomType = feature.geometry?.type;
        let matched = false;

        if (geomType === 'Polygon') {
          const rings = feature.geometry.coordinates;
          if (rings?.length > 0 && pointInPolygon(lat, lng, rings[0])) matched = true;
        } else if (geomType === 'MultiPolygon') {
          for (const rings of feature.geometry.coordinates) {
            if (rings?.length > 0 && pointInPolygon(lat, lng, rings[0])) {
              matched = true;
              break;
            }
          }
        }

        if (matched) {
          const name = feature.properties?.A32_004_ja || feature.properties?.A32_002 || null;
          const adminCode = feature.properties?.A32_001 || '';
          if (name) {
            console.log(`[nearbyMap] XKT005 判定成功（z=${ZOOM}）: ${name}`);
            return { name, adminCode };
          }
        }
      }

      console.warn(`[nearbyMap] XKT005 z=${ZOOM}: ${features.length}件あるがヒットせず`);
      // ヒットしなくてもより細かいズームで再試行
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.error('[nearbyMap] XKT005 401: APIキーが無効');
        return null; // キーが無効なら他のズームを試しても無意味
      }
      console.error(`[nearbyMap] XKT005 z=${ZOOM} エラー:`, err.message);
    }
  }

  return null; // 全ズームレベルでヒットなし
}

/**
 * Google Places API（Find Place from Text）で学校座標を取得
 * XKT005 で学校名が判明した後に座標を取得するために使用
 */
async function findSchoolCoordsByName(
  schoolName: string,
  nearLat: number,
  nearLng: number,
  mapsApiKey: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/findplacefromtext/json',
      {
        params: {
          input: schoolName,
          inputtype: 'textquery',
          fields: 'geometry,name',
          locationbias: `point:${nearLat},${nearLng}`,
          language: 'ja',
          key: mapsApiKey,
        },
        timeout: 10000,
      }
    );
    const candidate = response.data?.candidates?.[0];
    if (candidate?.geometry?.location) {
      return {
        lat: candidate.geometry.location.lat,
        lng: candidate.geometry.location.lng,
      };
    }
    return null;
  } catch (err: any) {
    console.error('[nearbyMap] findSchoolCoordsByName error:', err.message);
    return null;
  }
}

export default router;
