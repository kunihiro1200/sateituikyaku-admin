import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// ──────────────────────────────────────────────
// タイル座標変換ユーティリティ
// ──────────────────────────────────────────────

/** 緯度経度 → XYZタイル座標（zoomレベル指定） */
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

/** GeoJSONのFeatureが指定座標を含むか判定（Polygon/MultiPolygon対応） */
function featureContainsPoint(feature: any, lat: number, lng: number): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  const point: [number, number] = [lng, lat]; // GeoJSONは[lng, lat]

  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((poly: [number, number][][]) =>
      pointInPolygon(point, poly[0])
    );
  }
  return false;
}

// ──────────────────────────────────────────────
// 用途地域コード → 日本語名マッピング（フォールバック用）
// ──────────────────────────────────────────────

const YOUTO_CODE_MAP: Record<string, string> = {
  '1':  '第一種低層住居専用地域',
  '2':  '第二種低層住居専用地域',
  '3':  '第一種中高層住居専用地域',
  '4':  '第二種中高層住居専用地域',
  '5':  '第一種住居地域',
  '6':  '第二種住居地域',
  '7':  '準住居地域',
  '8':  '近隣商業地域',
  '9':  '商業地域',
  '10': '準工業地域',
  '11': '工業地域',
  '12': '工業専用地域',
  '21': '田園住居地域',
};

/**
 * XKT002のプロパティから用途地域名を取り出す
 */
function extractYoutoName(props: Record<string, any>): string | null {
  // XKT002の正式フィールド名（APIドキュメント確認済み）
  if (props.use_area_ja && typeof props.use_area_ja === 'string' && props.use_area_ja.trim()) {
    return props.use_area_ja.trim();
  }
  // フォールバック（旧フォーマット）
  const candidates = [
    props.youto_chiiki_name_ja,
    props.youto_name_ja,
    props.youto_name,
    props.A29_004,
    props.A29_005,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  // youto_id（整数コード）からマッピング
  const code = String(props.youto_id ?? props.youto_code ?? '');
  return YOUTO_CODE_MAP[code] ?? null;
}

// ──────────────────────────────────────────────
// reinfolib API 呼び出しヘルパー
// ──────────────────────────────────────────────

async function fetchGeoJSON(apiEndpoint: string, tile: { x: number; y: number; z: number }, apiKey: string): Promise<any[] | null> {
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/${apiEndpoint}?response_format=geojson&z=${tile.z}&x=${tile.x}&y=${tile.y}`;
  try {
    const response = await axios.get(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeout: 10000,
      decompress: true,
    });
    return response.data?.features ?? [];
  } catch (err: any) {
    if (err?.response?.status === 404) return []; // データなし（正常）
    console.error(`[youtoChiiki] ${apiEndpoint} error:`, err?.message, err?.response?.status);
    return null; // エラー
  }
}

// ──────────────────────────────────────────────
// ルート定義
// ──────────────────────────────────────────────

/**
 * 緯度・経度から用途地域・区域区分を取得する
 * GET /api/youto-chiiki?lat=33.55&lng=130.34
 *
 * 1. XKT002（用途地域）で座標を検索 → 用途地域名を返す
 * 2. 用途地域なし → XKT001（区域区分）で検索
 *    → 「市街化調整区域」「市街化区域（用途地域未指定）」「都市計画区域外」などを返す
 */
router.get('/', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat と lng は必須です' });
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat・lng は数値で指定してください' });
  }

  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) {
    console.warn('[youtoChiiki] REINFOLIB_API_KEY not set');
    return res.status(503).json({ error: 'REINFOLIB_API_KEY が設定されていません' });
  }

  const ZOOM = 15;
  const tile = latLngToTile(latNum, lngNum, ZOOM);

  try {
    // ── Step 1: XKT002（用途地域）を取得 ──
    const youtoFeatures = await fetchGeoJSON('XKT002', tile, apiKey);

    if (youtoFeatures === null) {
      return res.status(500).json({ error: '用途地域の取得に失敗しました' });
    }

    const youtoMatched = youtoFeatures.filter(f => featureContainsPoint(f, latNum, lngNum));

    if (youtoMatched.length > 0) {
      // 用途地域が見つかった
      const names: string[] = [];
      for (const f of youtoMatched) {
        const name = extractYoutoName(f.properties ?? {});
        if (name && !names.includes(name)) names.push(name);
        if (names.length >= 2) break;
      }
      if (names.length > 0) {
        return res.json({
          youtoChiiki1: names[0],
          youtoChiiki2: names[1] ?? null,
          source: 'XKT002',
        });
      }
    }

    // ── Step 2: 用途地域なし → XKT001（区域区分）で判定 ──
    const kubunFeatures = await fetchGeoJSON('XKT001', tile, apiKey);

    if (kubunFeatures !== null && kubunFeatures.length > 0) {
      const kubunMatched = kubunFeatures.filter(f => featureContainsPoint(f, latNum, lngNum));

      // area_classification_ja の優先順位：市街化調整区域 > 市街化区域 > 都市計画区域
      const priority = ['市街化調整区域', '市街化区域', '都市計画区域'];
      let found: string | null = null;

      for (const label of priority) {
        if (kubunMatched.some(f => f.properties?.area_classification_ja === label)) {
          found = label;
          break;
        }
      }

      if (!found && kubunMatched.length > 0) {
        found = kubunMatched[0].properties?.area_classification_ja ?? null;
      }

      if (found) {
        return res.json({
          youtoChiiki1: found,
          youtoChiiki2: null,
          source: 'XKT001',
        });
      }
    }

    // ── Step 3: どちらにもデータなし → 都市計画区域外 ──
    return res.json({
      youtoChiiki1: '都市計画区域外',
      youtoChiiki2: null,
      source: 'none',
    });

  } catch (err: any) {
    console.error('[youtoChiiki] Unexpected error:', err?.message);
    return res.status(500).json({ error: '用途地域の取得に失敗しました', detail: err?.message });
  }
});

export default router;

const router = Router();

// ──────────────────────────────────────────────
// タイル座標変換ユーティリティ
// ──────────────────────────────────────────────

/** 緯度経度 → XYZタイル座標（zoomレベル指定） */
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

/** GeoJSONのFeatureが指定座標を含むか判定（Polygon/MultiPolygon対応） */
function featureContainsPoint(feature: any, lat: number, lng: number): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  const point: [number, number] = [lng, lat]; // GeoJSONは[lng, lat]

  if (geom.type === 'Polygon') {
    return pointInPolygon(point, geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((poly: [number, number][][]) =>
      pointInPolygon(point, poly[0])
    );
  }
  return false;
}

// ──────────────────────────────────────────────
// 用途地域コード → 日本語名マッピング（フォールバック用）
// ──────────────────────────────────────────────

const YOUTO_CODE_MAP: Record<string, string> = {
  '1':  '第一種低層住居専用地域',
  '2':  '第二種低層住居専用地域',
  '3':  '第一種中高層住居専用地域',
  '4':  '第二種中高層住居専用地域',
  '5':  '第一種住居地域',
  '6':  '第二種住居地域',
  '7':  '準住居地域',
  '8':  '近隣商業地域',
  '9':  '商業地域',
  '10': '準工業地域',
  '11': '工業地域',
  '12': '工業専用地域',
  '21': '田園住居地域',
};

/**
 * XKT002のプロパティから用途地域名を取り出す
 * フィールド名はAPIバージョンで変わることがあるため複数候補を試す
 */
function extractYoutoName(props: Record<string, any>): string | null {
  // XKT002の正式フィールド名（APIドキュメント確認済み）
  if (props.use_area_ja && typeof props.use_area_ja === 'string' && props.use_area_ja.trim()) {
    return props.use_area_ja.trim();
  }
  // フォールバック（旧フォーマット）
  const candidates = [
    props.youto_chiiki_name_ja,
    props.youto_name_ja,
    props.youto_name,
    props.A29_004,
    props.A29_005,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim()) return c.trim();
  }
  // youto_id（整数コード）からマッピング
  const code = String(props.youto_id ?? props.youto_code ?? '');
  return YOUTO_CODE_MAP[code] ?? null;
}

// ──────────────────────────────────────────────
// ルート定義
// ──────────────────────────────────────────────

/**
 * 緯度・経度から用途地域を取得する
 * GET /api/youto-chiiki?lat=33.55&lng=130.34
 *
 * 不動産情報ライブラリ XKT002（都市計画決定GISデータ 用途地域）を使用。
 * タイルズームレベル15でタイルを取得し、座標を含むポリゴンの用途地域を返す。
 * REINFOLIB_API_KEY 環境変数が必要。
 */
router.get('/', async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat と lng は必須です' });
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat・lng は数値で指定してください' });
  }

  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) {
    console.warn('[youtoChiiki] REINFOLIB_API_KEY not set');
    return res.status(503).json({ error: 'REINFOLIB_API_KEY が設定されていません' });
  }

  const ZOOM = 15;
  const tile = latLngToTile(latNum, lngNum, ZOOM);
  // response_format は必須パラメータ
  const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT002?response_format=geojson&z=${tile.z}&x=${tile.x}&y=${tile.y}`;

  console.log(`[youtoChiiki] lat=${latNum}, lng=${lngNum} → tile z=${tile.z} x=${tile.x} y=${tile.y}`);

  try {
    const response = await axios.get(url, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeout: 10000,
      // GeoJSONはgzip圧縮されて返る場合あり
      decompress: true,
    });

    const geojson = response.data;
    const features: any[] = geojson?.features ?? [];

    console.log(`[youtoChiiki] features count: ${features.length}`);

    // 座標を含むポリゴンを全て探す
    const matched = features.filter(f => featureContainsPoint(f, latNum, lngNum));

    if (matched.length === 0) {
      return res.json({
        youtoChiiki1: null,
        youtoChiiki2: null,
        note: '指定座標に対応する用途地域なし（市街化調整区域等の可能性）',
        source: 'reinfolib_XKT002',
      });
    }

    // 名前を取り出す（重複除去）
    const names: string[] = [];
    for (const f of matched) {
      const name = extractYoutoName(f.properties ?? {});
      if (name && !names.includes(name)) names.push(name);
      if (names.length >= 2) break;
    }

    return res.json({
      youtoChiiki1: names[0] ?? null,
      youtoChiiki2: names[1] ?? null,
      source: 'reinfolib_XKT002',
    });

  } catch (err: any) {
    if (err?.response?.status === 401) {
      console.error('[youtoChiiki] 401 Unauthorized');
      return res.status(401).json({ error: 'REINFOLIB_API_KEY が無効です' });
    }
    if (err?.response?.status === 400) {
      console.error('[youtoChiiki] 400 Bad Request:', JSON.stringify(err?.response?.data));
      return res.status(500).json({ error: '用途地域の取得に失敗しました', detail: err?.message });
    }
    if (err?.response?.status === 404) {
      // タイルにデータなし
      return res.json({
        youtoChiiki1: null,
        youtoChiiki2: null,
        note: 'タイルデータなし',
        source: 'reinfolib_XKT002',
      });
    }
    console.error('[youtoChiiki] Error:', err?.message, err?.response?.status);
    return res.status(500).json({
      error: '用途地域の取得に失敗しました',
      detail: err?.message,
    });
  }
});

export default router;
