import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';

const router = Router();

// メモリストレージ（ファイルをバッファとして保持）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

/**
 * ハザードマップ索引図をClaude Vision APIで解析し、該当番号を返す
 * POST /api/hazard/analyze
 * multipart/form-data:
 *   - image: 索引図ファイル（画像 or PDFの1ページ目をPNG変換したもの）
 *   - lat: 緯度
 *   - lng: 経度
 */
router.post('/analyze', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const file = req.file;

    console.log(`[HazardAnalyze] received - lat=${lat}, lng=${lng}, file=${file ? `${file.originalname} (${file.mimetype}, ${file.size}bytes)` : 'NONE'}`);

    if (!file) {
      return res.status(400).json({ error: '索引図ファイルが必要です', detail: 'file is undefined - check multipart/form-data field name "image"' });
    }
    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
    }

    // 画像をbase64に変換
    const imageBase64 = file.buffer.toString('base64');
    // mimetypeを安全なAnthropicの型に変換
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = (allowedTypes.includes(file.mimetype) ? file.mimetype : 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `これは日本のハザードマップの索引図（インデックスマップ）です。

この索引図には、地図全体を複数のエリアに分割した区画が描かれており、
各区画には「1」「2」「3」「4」「5」などの番号が付いています。

以下のGPS座標の場所が、この索引図のどの番号のエリアに含まれるか判定してください。

緯度（Latitude）: ${lat}
経度（Longitude）: ${lng}

判定手順：
1. 索引図に描かれている地図の範囲（緯度・経度の範囲）を読み取る
2. 上記座標がどの番号のエリアの区画内に位置するかを特定する
3. 番号のみを回答する

回答は数字1文字のみ（例: 2）を返してください。
判断できない場合のみ「不明」と返してください。`,
            },
          ],
        },
      ],
    });

    const resultText = message.content[0].type === 'text' ? message.content[0].text.trim() : '不明';

    // 数字のみ抽出（「2番」「No.2」などにも対応）
    const numberMatch = resultText.match(/\d+/);
    const pageNo = numberMatch ? parseInt(numberMatch[0], 10) : null;

    console.log(`[HazardAnalyze] lat=${lat}, lng=${lng} → Claude回答: "${resultText}" → pageNo: ${pageNo}`);

    res.json({
      pageNo,
      rawAnswer: resultText,
      success: pageNo !== null,
    });
  } catch (error: any) {
    console.error('[HazardAnalyze] Error:', error.message);
    res.status(500).json({
      error: 'AI解析に失敗しました',
      message: error.message,
    });
  }
});

/**
 * 詳細ハザードマップPDF（画像化済み）上の座標位置をClaude Vision APIで特定し、
 * 赤丸を付けるべき位置（x%, y%）を返す
 * POST /api/hazard/locate
 * multipart/form-data:
 *   - image: 詳細ハザードマップの画像（PDFをCanvasでレンダリングしたもの）
 *   - lat: 緯度
 *   - lng: 経度
 */
router.post('/locate', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '地図画像ファイルが必要です' });
    }
    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
    }

    const imageBase64 = file.buffer.toString('base64');
    const mediaType = (file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/png';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `これは日本のハザードマップの詳細地図画像です。

この地図画像の四隅（左上・右上・左下・右下）の緯度経度を読み取り、
その情報をもとに以下の座標が地図上のどの位置（x%, y%）にあるかを計算してください。

対象座標:
緯度（Latitude）: ${lat}
経度（Longitude）: ${lng}

手順:
1. 地図の左上の緯度経度を読み取る（例: 北緯33.30°, 東経131.48°）
2. 地図の右下の緯度経度を読み取る（例: 北緯33.26°, 東経131.51°）
3. 線形補間で x% = (lng - 左端経度) / (右端経度 - 左端経度) * 100
4. 線形補間で y% = (上端緯度 - lat) / (上端緯度 - 下端緯度) * 100

必ず以下のJSON形式のみで回答してください（説明不要）:
{"x": 数値, "y": 数値, "mapLeft": 左端経度, "mapRight": 右端経度, "mapTop": 上端緯度, "mapBottom": 下端緯度}

例: {"x": 65.5, "y": 42.3, "mapLeft": 131.48, "mapRight": 131.51, "mapTop": 33.30, "mapBottom": 33.26}`,
            },
          ],
        },
      ],
    });

    const resultText = message.content[0].type === 'text' ? message.content[0].text.trim() : '{"x":50,"y":50}';
    console.log(`[HazardLocate] lat=${lat}, lng=${lng} → Claude回答: "${resultText}"`);

    // JSONを抽出
    const jsonMatch = resultText.match(/\{[\s\S]*?\}/);
    let x = 50, y = 50;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // 地図の四隅が取得できた場合は線形補間で再計算（より正確）
        if (parsed.mapLeft && parsed.mapRight && parsed.mapTop && parsed.mapBottom) {
          const latNum = parseFloat(lat);
          const lngNum = parseFloat(lng);
          x = ((lngNum - parsed.mapLeft) / (parsed.mapRight - parsed.mapLeft)) * 100;
          y = ((parsed.mapTop - latNum) / (parsed.mapTop - parsed.mapBottom)) * 100;
          x = Math.min(100, Math.max(0, x));
          y = Math.min(100, Math.max(0, y));
          console.log(`[HazardLocate] 線形補間計算: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
        } else {
          x = typeof parsed.x === 'number' ? Math.min(100, Math.max(0, parsed.x)) : 50;
          y = typeof parsed.y === 'number' ? Math.min(100, Math.max(0, parsed.y)) : 50;
        }
      } catch {
        console.warn('[HazardLocate] JSON parse failed, using center');
      }
    }

    res.json({ x, y, rawAnswer: resultText });
  } catch (error: any) {
    console.error('[HazardLocate] Error:', error.message);
    res.status(500).json({
      error: 'AI位置特定に失敗しました',
      message: error.message,
    });
  }
});

/**
 * 別府市道路台帳図の索引図から該当番号を判定する
 * POST /api/hazard/beppu-road-map
 * multipart/form-data:
 *   - image: 別府市道路台帳図の索引図画像
 *   - lat: 緯度
 *   - lng: 経度
 */
router.post('/beppu-road-map', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const file = req.file;

    console.log(`[BeppuRoadMap] received - lat=${lat}, lng=${lng}, file=${file ? `${file.originalname} (${file.mimetype}, ${file.size}bytes)` : 'NONE'}`);

    if (!file) {
      return res.status(400).json({ error: '索引図ファイルが必要です' });
    }
    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
    }

    const imageBase64 = file.buffer.toString('base64');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = (allowedTypes.includes(file.mimetype) ? file.mimetype : 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `これは大分県別府市の「道路台帳図索引図」です。

この索引図は別府市全体を1〜143（またはそれ以上）の番号付き区画に分割した地図です。
各区画は四角形で、番号が中央に記載されています。

以下のGPS座標が、この索引図のどの番号の区画に含まれるか判定してください。

緯度（Latitude）: ${lat}
経度（Longitude）: ${lng}

【別府市の地理的情報】
- 別府市は大分県東部、別府湾に面した市
- 緯度範囲: 北緯33.2°〜33.4°付近
- 経度範囲: 東経131.4°〜131.6°付近
- 海岸線は東側（経度が大きい側）
- 山地は西側（経度が小さい側）

【判定手順】
1. 索引図の全体的な地理的範囲（北端・南端・東端・西端の緯度経度）を推定する
2. 索引図内の各区画の位置関係を把握する（番号の配置パターンを読み取る）
3. 指定座標（緯度${lat}、経度${lng}）がどの区画に該当するか特定する
4. 該当する区画番号のみを回答する

回答は番号のみ（例: 57）を返してください。
判断できない場合のみ「不明」と返してください。`,
            },
          ],
        },
      ],
    });

    const resultText = message.content[0].type === 'text' ? message.content[0].text.trim() : '不明';

    // 数字のみ抽出（「57番」「No.57」などにも対応）
    const numberMatch = resultText.match(/\d+/);
    const pageNo = numberMatch ? parseInt(numberMatch[0], 10) : null;

    console.log(`[BeppuRoadMap] lat=${lat}, lng=${lng} → Claude回答: "${resultText}" → pageNo: ${pageNo}`);

    res.json({
      pageNo,
      rawAnswer: resultText,
      success: pageNo !== null,
    });
  } catch (error: any) {
    console.error('[BeppuRoadMap] Error:', error.message);
    res.status(500).json({
      error: 'AI解析に失敗しました',
      message: error.message,
    });
  }
});

export default router;
