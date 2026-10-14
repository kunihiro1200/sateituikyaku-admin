/**
 * 中学校区データ生成エンドポイント
 * GET /api/build-middle-school-districts?token=BUILD_TOKEN
 *
 * XKT005（国土数値情報 中学校区）API から福岡県(40)・大分県(44)の
 * 全中学校区ポリゴンを取得し、school-districts.json と同じ形式で返す。
 *
 * 使い方（一度だけ実行して結果を保存）:
 *   curl -o middle-school-districts.json \
 *     "https://sateituikyaku-admin-backend.vercel.app/api/build-middle-school-districts?token=BUILD_MSCHOOL_2026"
 *
 * 取得後: backend/src/data/middle-school-districts.json として保存してコミット
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// z=11 の緯度経度→タイル変換
function latLngToTile(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor((lng + 180.0) / 360.0 * n);
  const latRad = lat * Math.PI / 180.0;
  const y = Math.floor((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0 * n);
  return { x, y };
}

// 対象エリアのタイル一覧を生成（z=11）
function buildTileList(z: number): Array<{ x: number; y: number }> {
  // 福岡県・大分県をカバーするエリア（z=11）
  // 福岡: lat 33.0-34.2, lng 129.7-131.2
  // 大分: lat 32.7-33.7, lng 130.8-132.1
  const areas = [
    { latMin: 33.0, latMax: 34.3, lngMin: 129.7, lngMax: 131.3 }, // 福岡県
    { latMin: 32.6, latMax: 33.7, lngMin: 130.7, lngMax: 132.2 }, // 大分県
  ];

  const tiles = new Set<string>();
  for (const area of areas) {
    const tl = latLngToTile(area.latMax, area.lngMin, z);
    const br = latLngToTile(area.latMin, area.lngMax, z);
    for (let x = tl.x; x <= br.x; x++) {
      for (let y = tl.y; y <= br.y; y++) {
        tiles.add(`${x},${y}`);
      }
    }
  }

  return Array.from(tiles).map(t => {
    const [x, y] = t.split(',').map(Number);
    return { x, y };
  });
}

router.get('/build-middle-school-districts', async (req: Request, res: Response) => {
  // 簡易トークン認証（公開エンドポイントにしない）
  if (req.query.token !== 'BUILD_MSCHOOL_2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const reinfilibKey = process.env.REINFOLIB_API_KEY;
  if (!reinfilibKey) {
    return res.status(500).json({ error: 'REINFOLIB_API_KEY が設定されていません' });
  }

  const ZOOM = 11;
  const tiles = buildTileList(ZOOM);
  console.log(`[buildMSD] 対象タイル数: ${tiles.length}`);

  // フィーチャーをマップで管理（重複排除）
  const featureMap = new Map<string, any>();
  let apiCallCount = 0;
  let errorCount = 0;
  let emptyCount = 0;

  // 10件ずつバッチ処理
  const BATCH_SIZE = 10;
  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ x, y }) => {
      const url = `https://www.reinfolib.mlit.go.jp/ex-api/external/XKT005?response_format=geojson&z=${ZOOM}&x=${x}&y=${y}`;
      try {
        const resp = await axios.get(url, {
          headers: { 'Ocp-Apim-Subscription-Key': reinfilibKey },
          timeout: 15000,
        });
        apiCallCount++;
        const features: any[] = resp.data?.features ?? [];
        if (features.length === 0) { emptyCount++; return; }

        for (const f of features) {
          const name = f.properties?.A32_004_ja || f.properties?.A32_002;
          const adminCode = f.properties?.A32_001 || '';
          const prefecture = adminCode.substring(0, 2);
          if (!name) continue;

          // 重複排除キー（school code が最良だが名前でも可）
          const key = f.properties?.A32_003 || `${name}_${adminCode}`;
          if (!featureMap.has(key)) {
            featureMap.set(key, {
              type: 'Feature',
              properties: { name, adminCode, prefecture },
              geometry: f.geometry,
            });
          }
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          errorCount++;
          console.error(`[buildMSD] 401 Unauthorized: APIキーが無効`);
        } else {
          errorCount++;
          console.warn(`[buildMSD] z=${ZOOM} x=${x} y=${y} エラー:`, err.message);
        }
      }
    }));

    // バッチ間に少し待機（レート制限対策）
    await new Promise(r => setTimeout(r, 200));
  }

  const features = Array.from(featureMap.values());
  console.log(`[buildMSD] 完了: フィーチャー${features.length}件, API${apiCallCount}回, 空タイル${emptyCount}件, エラー${errorCount}件`);

  const geojson = { type: 'FeatureCollection', features };

  // Content-Disposition でファイルとしてダウンロード
  res.setHeader('Content-Disposition', 'attachment; filename="middle-school-districts.json"');
  res.setHeader('Content-Type', 'application/json');
  return res.json(geojson);
});

export default router;
