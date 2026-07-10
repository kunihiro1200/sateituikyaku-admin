import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// 用途地域コード → 日本語名のマッピング
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
  '99': '用途地域なし（市街化調整区域等）',
};

/**
 * 緯度・経度から用途地域を取得する
 * GET /api/youto-chiiki?lat=33.55&lng=130.34
 *
 * 不動産情報ライブラリAPI（reinfolib.mlit.go.jp）の
 * XPT001（都市計画情報取得API）を使用。
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

  try {
    console.log(`[youtoChiiki] Fetching: lat=${latNum}, lng=${lngNum}`);

    const response = await axios.get(
      'https://www.reinfolib.mlit.go.jp/ex-api/external/XPT001',
      {
        params: {
          lat: latNum,
          lon: lngNum,
        },
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    console.log('[youtoChiiki] Raw response:', JSON.stringify(data).substring(0, 500));

    // XPT001のレスポンス解析
    // レスポンス例: { "data": [{ "youto": "5", "youto_name": "第一種住居地域", ... }] }
    const items: any[] = data?.data || data?.result || [];

    if (items.length === 0) {
      return res.json({
        youtoChiiki1: null,
        youtoChiiki2: null,
        source: 'reinfolib',
        raw: data,
      });
    }

    // 用途地域を最大2件取得
    const zones: string[] = [];
    for (const item of items.slice(0, 2)) {
      // フィールド名はAPIバージョンにより異なる場合がある
      const name =
        item.youto_name ||
        item.YOUTO_NAME ||
        YOUTO_CODE_MAP[String(item.youto || item.YOUTO || '')] ||
        item.youto ||
        item.YOUTO ||
        null;

      if (name && !zones.includes(name)) {
        zones.push(String(name));
      }
    }

    return res.json({
      youtoChiiki1: zones[0] ?? null,
      youtoChiiki2: zones[1] ?? null,
      source: 'reinfolib',
    });

  } catch (err: any) {
    // 401 → APIキーが無効
    if (err?.response?.status === 401) {
      console.error('[youtoChiiki] 401 Unauthorized - APIキーを確認してください');
      return res.status(401).json({ error: 'REINFOLIB_API_KEY が無効です' });
    }

    // 404 → 対象座標にデータなし（市街化調整区域等）
    if (err?.response?.status === 404) {
      return res.json({
        youtoChiiki1: null,
        youtoChiiki2: null,
        note: '指定座標の用途地域データなし（市街化調整区域等の可能性）',
        source: 'reinfolib',
      });
    }

    console.error('[youtoChiiki] Error:', err?.message, err?.response?.data);
    return res.status(500).json({
      error: '用途地域の取得に失敗しました',
      detail: err?.message,
    });
  }
});

export default router;
