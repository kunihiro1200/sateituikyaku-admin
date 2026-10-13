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
//   - isEstimated=false: Directions API による実測値
//   - isEstimated=true : Directions API 不可時のハーバーサイン直線 × 1.3 推定値
async function fetchWalkingDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<{ meters: number; isEstimated: boolean }> {
  // ---- Directions API を試みる ----
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
    console.warn('[nearbyMap] Directions API status:', response.data.status,
      '→ ハーバーサイン推定値にフォールバック');
  } catch (err: any) {
    console.warn('[nearbyMap] Directions API error:', err.message,
      '→ ハーバーサイン推定値にフォールバック');
  }

  // ---- フォールバック: 直線距離 × 1.3（一般的な迂回係数） ----
  const straightMeters = calcDistance(originLat, originLng, destLat, destLng);
  const estimatedMeters = Math.round(straightMeters * 1.3);
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

    // ---- 小学校: GeoJSON Point-in-Polygon で学区判定 ----
    const districtData = loadSchoolDistricts();
    let elementarySchoolNameFromDistrict: string | null = null;

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

    // ---- 小学校: Places API で座標取得 ----
    // カスタム正門座標がある場合はそれを優先
    let elementarySchoolResult: {
      name: string; lat: number; lng: number; districtConfirmed: boolean;
    } | null = null;

    const customElemLat = elementaryLat ? parseFloat(elementaryLat as string) : null;
    const customElemLng = elementaryLng ? parseFloat(elementaryLng as string) : null;

    if (customElemLat && customElemLng) {
      // カスタム正門座標が設定済み → Places APIをスキップして既存名称を維持するため別処理
      // 名前は Places Nearby から最近接取得
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
      const schoolName = candidates[0]?.name || elementarySchoolNameFromDistrict || '小学校';
      elementarySchoolResult = { name: schoolName, lat: customElemLat, lng: customElemLng, districtConfirmed: true };
    } else {
      // Places Nearby Search で5km以内の小学校一覧を取得し、学区名に最も近いものを選ぶ
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
        // GeoJSON で判定した学校名と照合（部分一致）
        let bestCandidate = candidates[0];
        if (elementarySchoolNameFromDistrict) {
          const matched = candidates.find((c: any) =>
            c.name.includes(elementarySchoolNameFromDistrict!) ||
            (elementarySchoolNameFromDistrict!).includes(c.name.replace(/^.*立/, ''))
          );
          if (matched) bestCandidate = matched;
        }
        elementarySchoolResult = {
          name: bestCandidate.name,
          lat: bestCandidate.geometry.location.lat,
          lng: bestCandidate.geometry.location.lng,
          districtConfirmed: !!elementarySchoolNameFromDistrict,
        };
      } else if (elementarySchoolNameFromDistrict) {
        // Places API にヒットなし → GeoJSON の学校名のみ返す（距離は計算不能）
        elementarySchoolResult = {
          name: elementarySchoolNameFromDistrict,
          lat: latNum,
          lng: lngNum,
          districtConfirmed: true,
        };
      }
    }

    // ---- 中学校: Places API で最近接中学校を取得 ----
    // ※中学校区のGeoJSONデータは未整備のため最近接を参考表示（UIで要確認表示）
    let juniorHighSchoolResult: {
      name: string; lat: number; lng: number;
    } | null = null;

    const customJhLat = juniorHighLat ? parseFloat(juniorHighLat as string) : null;
    const customJhLng = juniorHighLng ? parseFloat(juniorHighLng as string) : null;

    if (customJhLat && customJhLng) {
      const nearbyRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        {
          params: {
            location: `${customJhLat},${customJhLng}`,
            radius: 200,
            type: 'school',
            keyword: '中学校',
            language: 'ja',
            key: apiKey,
          },
          timeout: 10000,
        }
      );
      const candidates = (nearbyRes.data.results || []).filter((r: any) => /中学校/.test(r.name));
      const schoolName = candidates[0]?.name || '中学校';
      juniorHighSchoolResult = { name: schoolName, lat: customJhLat, lng: customJhLng };
    } else {
      const nearbyRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        {
          params: {
            location: `${latNum},${lngNum}`,
            radius: 6000,
            type: 'school',
            keyword: '中学校',
            language: 'ja',
            key: apiKey,
          },
          timeout: 10000,
        }
      );
      const candidates: any[] = (nearbyRes.data.results || []).filter((r: any) => /中学校/.test(r.name));
      if (candidates.length > 0) {
        // 直線距離でソートして最近接を選ぶ
        candidates.sort((a: any, b: any) => {
          const da = calcDistance(latNum, lngNum, a.geometry.location.lat, a.geometry.location.lng);
          const db = calcDistance(latNum, lngNum, b.geometry.location.lat, b.geometry.location.lng);
          return da - db;
        });
        const best = candidates[0];
        juniorHighSchoolResult = {
          name: best.name,
          lat: best.geometry.location.lat,
          lng: best.geometry.location.lng,
        };
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
          }
        : null,
      juniorHighSchool: juniorHighSchoolResult
        ? {
            name: juniorHighSchoolResult.name,
            distanceMeters: jhResult?.meters ?? null,
            walkMinutes: jhResult ? calcWalkMinutes(jhResult.meters) : null,
            isEstimated: jhResult?.isEstimated ?? false,
            lat: juniorHighSchoolResult.lat,
            lng: juniorHighSchoolResult.lng,
            districtConfirmed: false, // 中学校区GeoJSONなし → 常にfalse（要確認）
          }
        : null,
    });
  } catch (error: any) {
    console.error('[nearbyMap] school-walk error:', error.message);
    return res.status(500).json({ error: '学校徒歩距離の取得に失敗しました' });
  }
});

export default router;
