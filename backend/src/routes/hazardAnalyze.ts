import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import axios from 'axios';

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

// ============================================================
// 別府市道路台帳図 基準点データ（番号 → 中心座標）
// 実測値に基づく19点の基準点
// 注意: この索引図は90度回転しており、右=北、左=南、上=西、下=東
// ============================================================
const BEPPU_ROAD_MAP_ANCHORS: Array<{ no: number; lat: number; lng: number }> = [
  { no: 133, lat: 33.26566, lng: 131.51658 },
  { no: 24,  lat: 33.33736, lng: 131.46838 },
  { no: 95,  lat: 33.28864, lng: 131.46110 },
  { no: 18,  lat: 33.34597, lng: 131.49538 },
  { no: 76,  lat: 33.30268, lng: 131.47908 },
  { no: 97,  lat: 33.29015, lng: 131.47857 },
  { no: 119, lat: 33.27607, lng: 131.50114 },
  { no: 100, lat: 33.28749, lng: 131.50259 },
  { no: 78,  lat: 33.30270, lng: 131.49263 },
  { no: 64,  lat: 33.30966, lng: 131.48968 },
  { no: 62,  lat: 33.31187, lng: 131.47857 },
  { no: 49,  lat: 33.31858, lng: 131.48393 },
  { no: 36,  lat: 33.33014, lng: 131.49096 },
  { no: 44,  lat: 33.32314, lng: 131.48996 },
  { no: 26,  lat: 33.33884, lng: 131.48610 },
  { no: 55,  lat: 33.31509, lng: 131.47578 },
  { no: 67,  lat: 33.30624, lng: 131.46084 },
  { no: 82,  lat: 33.29922, lng: 131.47007 },
  { no: 118, lat: 33.27529, lng: 131.49163 },
];

// 区画サイズ（実測値から推定）
// 緯度方向: 約0.0075° / 区画
// 経度方向: 約0.0090° / 区画
// 索引図は90度回転: 右=北(lat大), 左=南(lat小), 上=西(lng小), 下=東(lng大)
// 列方向 = 南北(緯度), 行方向 = 東西(経度)
// 1列あたりの区画数: lng≈131.49列に26,36,44,64,78,118の6点 → 約7区画/列
const CELL_LAT = 0.0075; // 緯度方向の区画サイズ
const CELL_LNG = 0.0090; // 経度方向の区画サイズ

/**
 * 逆距離加重補間（IDW）で番号を推定する
 *
 * アルゴリズム:
 * 1. 全基準点との距離を計算
 * 2. 最近傍が区画サイズ以内なら直接その番号を返す（高信頼）
 * 3. 近傍上位N点の番号を距離の逆数で加重平均して推定
 * 4. 推定番号から最も近い基準点の番号を参考に補正
 */
function estimateBeppuRoadMapNo(lat: number, lng: number): { pageNo: number; confidence: string; nearestNo: number; distKm: number } {
  // 距離計算（km）- 別府市付近の係数
  const distKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dlat = (a.lat - b.lat) * 111.0;
    const dlng = (a.lng - b.lng) * 91.0;
    return Math.sqrt(dlat * dlat + dlng * dlng);
  };

  // 全基準点との距離を計算してソート
  const withDist = BEPPU_ROAD_MAP_ANCHORS.map(a => ({
    ...a,
    dist: distKm({ lat, lng }, { lat: a.lat, lng: a.lng }),
  })).sort((a, b) => a.dist - b.dist);

  const nearest = withDist[0];

  // 最近傍が区画サイズ以内なら直接その番号（高信頼）
  const cellSizeKm = Math.sqrt(Math.pow(CELL_LAT * 111, 2) + Math.pow(CELL_LNG * 91, 2)) / 2;
  if (nearest.dist < cellSizeKm * 0.6) {
    return { pageNo: nearest.no, confidence: 'high', nearestNo: nearest.no, distKm: nearest.dist };
  }

  // 最近傍基準点からのオフセットを区画単位で計算して番号を推定
  // 索引図の構造:
  //   - 緯度が小さい（南）ほど番号が大きい
  //   - 経度が大きい（東）ほど番号が大きい
  //   - 列方向（南北）: 1列あたり約7区画
  //   - 行方向（東西）: 列が変わると番号が大きく変わる
  //
  // 実測から判明した列構造:
  //   lng≈131.46: 67, 95 (南北2点)
  //   lng≈131.47: 24, 82 (南北2点)
  //   lng≈131.48: 49, 55, 62, 76, 97 (南北5点)
  //   lng≈131.49: 26, 36, 44, 64, 78, 118 (南北6点)
  //   lng≈131.50: 18, 100, 119 (南北3点)
  //   lng≈131.51: 133 (1点)
  //
  // 番号の増加方向: 北東(小) → 南西(大)
  // 列間の番号差: 約7〜8

  // 最近傍基準点からの緯度・経度オフセット
  const dlat = lat - nearest.lat;
  const dlng = lng - nearest.lng;

  // 区画単位でのオフセット
  // 緯度が減る（南）→ 番号が増える → rowOffset正
  // 経度が増える（東）→ 番号が増える → colOffset正
  const rowOffset = Math.round(-dlat / CELL_LAT); // 南方向が正
  const colOffset = Math.round(dlng / CELL_LNG);  // 東方向が正

  // 列あたりの行数（索引図から推定: 約7行/列）
  const ROWS_PER_COL = 7;

  // 推定番号 = 最近傍番号 + 行オフセット + 列オフセット×列あたり行数
  const estimatedNo = nearest.no + rowOffset + colOffset * ROWS_PER_COL;
  const clampedNo = Math.max(1, Math.min(143, Math.round(estimatedNo)));

  const confidence = nearest.dist < 1.0 ? 'medium' : 'low';

  return { pageNo: clampedNo, confidence, nearestNo: nearest.no, distKm: nearest.dist };
}

/**
 * 別府市道路台帳図の索引図から該当番号を判定する（計算ベース・AIなし）
 * POST /api/hazard/beppu-road-map
 * body (JSON):
 *   - lat: 緯度
 *   - lng: 経度
 */
router.post('/beppu-road-map', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    console.log(`[BeppuRoadMap] received - lat=${lat}, lng=${lng}`);

    if (!lat || !lng) {
      return res.status(400).json({ error: '緯度・経度が必要です' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ error: '緯度・経度が数値ではありません' });
    }

    const result = estimateBeppuRoadMapNo(latNum, lngNum);

    // 画像上のハイライト位置を計算
    // 索引図の地理的範囲（基準点から推定）
    const MAP_LAT_MIN = 33.25816;
    const MAP_LAT_MAX = 33.35347;
    const MAP_LNG_MIN = 131.45184;
    const MAP_LNG_MAX = 131.52558;
    // 索引図は90度回転: 右=北(lat大), 左=南(lat小), 上=西(lng小), 下=東(lng大)
    // x(左右) = lat方向, y(上下) = lng方向
    const highlightX = ((latNum - MAP_LAT_MIN) / (MAP_LAT_MAX - MAP_LAT_MIN)) * 100;
    const highlightY = ((lngNum - MAP_LNG_MIN) / (MAP_LNG_MAX - MAP_LNG_MIN)) * 100;

    console.log(`[BeppuRoadMap] lat=${latNum}, lng=${lngNum} → No.${result.pageNo} (confidence=${result.confidence}, nearest=${result.nearestNo}, dist=${result.distKm.toFixed(2)}km, highlight=${highlightX.toFixed(1)}%,${highlightY.toFixed(1)}%)`);

    res.json({
      pageNo: result.pageNo,
      confidence: result.confidence,
      nearestNo: result.nearestNo,
      distKm: result.distKm,
      highlightX: Math.min(100, Math.max(0, highlightX)),
      highlightY: Math.min(100, Math.max(0, highlightY)),
      success: true,
    });
  } catch (error: any) {
    console.error('[BeppuRoadMap] Error:', error.message);
    res.status(500).json({
      error: '番号判定に失敗しました',
      message: error.message,
    });
  }
});

/**
 * ランドマーク照合によるアフィン変換で赤丸位置を精密特定
 * POST /api/hazard/locate-by-landmark
 * multipart/form-data:
 *   - hazard: ハザードマップ画像
 *   - zenrin: ゼンリン地図画像（赤い印付き）
 *   - address: 物件住所（任意）
 *
 * 処理フロー:
 * 1. ゼンリン地図から複数ランドマークの位置(x%,y%)と赤い印の位置を取得
 * 2. ハザードマップから同じランドマークの位置(x%,y%)を取得
 * 3. 対応点からアフィン変換行列を計算（最小二乗法）
 * 4. ゼンリンの赤い印位置をハザードマップ座標に変換
 */
router.post('/locate-by-landmark', upload.fields([
  { name: 'hazard', maxCount: 1 },
  { name: 'zenrin', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const hazardFile = files?.['hazard']?.[0];
    const zenrinFile = files?.['zenrin']?.[0];
    const address = req.body.address || '';

    if (!hazardFile || !zenrinFile) {
      return res.status(400).json({ error: 'ハザードマップとゼンリン地図の両方が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
    }

    const hazardBase64 = hazardFile.buffer.toString('base64');
    const zenrinBase64 = zenrinFile.buffer.toString('base64');
    const toMediaType = (mime: string) =>
      (['image/jpeg','image/png','image/gif','image/webp'].includes(mime) ? mime : 'image/png') as
      'image/jpeg'|'image/png'|'image/gif'|'image/webp';

    const client = new Anthropic({ apiKey });

    // --- Step1: ゼンリン地図からランドマーク位置と赤い印位置を取得 ---
    const zenrinMsg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: toMediaType(zenrinFile.mimetype), data: zenrinBase64 },
          },
          {
            type: 'text',
            text: `これはゼンリン地図です。${address ? `物件住所: ${address}` : ''}

以下の2つを特定してください：

1. 地図上の赤い印（マーク・十字・ピン等）の位置
2. 地図上に記載されている施設名・道路名・建物名などのランドマーク（できるだけ多く、最低5個）

画像の左上を(0,0)、右下を(100,100)として各位置のx%, y%を答えてください。

必ず以下のJSON形式のみで回答してください：
{
  "redMark": {"x": 数値, "y": 数値},
  "landmarks": [
    {"name": "施設名や道路名", "x": 数値, "y": 数値},
    {"name": "施設名や道路名", "x": 数値, "y": 数値}
  ]
}`,
          },
        ],
      }],
    });

    const zenrinText = zenrinMsg.content[0].type === 'text' ? zenrinMsg.content[0].text.trim() : '';
    console.log(`[HazardLandmark] Step1 ゼンリン解析: ${zenrinText}`);

    const zenrinJsonMatch = zenrinText.match(/\{[\s\S]*\}/);
    if (!zenrinJsonMatch) {
      return res.status(500).json({ error: 'ゼンリン地図の解析に失敗しました', rawAnswer: zenrinText });
    }
    const zenrinData = JSON.parse(zenrinJsonMatch[0]);
    const zenrinRedMark: {x:number,y:number} = zenrinData.redMark;
    const zenrinLandmarks: Array<{name:string,x:number,y:number}> = zenrinData.landmarks || [];

    if (!zenrinRedMark || zenrinLandmarks.length < 2) {
      return res.status(500).json({ error: 'ゼンリン地図からランドマークを十分取得できませんでした', rawAnswer: zenrinText });
    }

    // --- Step2: ハザードマップから同じランドマーク位置を取得 ---
    const landmarkNames = zenrinLandmarks.map(l => `「${l.name}」`).join('、');
    const hazardMsg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: toMediaType(hazardFile.mimetype), data: hazardBase64 },
          },
          {
            type: 'text',
            text: `これはハザードマップの詳細地図です。

以下のランドマークがこの地図上のどこにあるか特定してください：
${landmarkNames}

画像の左上を(0,0)、右下を(100,100)として各位置のx%, y%を答えてください。
地図上に見当たらないランドマークはnullにしてください。

必ず以下のJSON形式のみで回答してください：
{
  "landmarks": [
    {"name": "施設名や道路名", "x": 数値または null, "y": 数値または null},
    ...
  ]
}`,
          },
        ],
      }],
    });

    const hazardText = hazardMsg.content[0].type === 'text' ? hazardMsg.content[0].text.trim() : '';
    console.log(`[HazardLandmark] Step2 ハザード解析: ${hazardText}`);

    const hazardJsonMatch = hazardText.match(/\{[\s\S]*\}/);
    if (!hazardJsonMatch) {
      return res.status(500).json({ error: 'ハザードマップの解析に失敗しました', rawAnswer: hazardText });
    }
    const hazardData = JSON.parse(hazardJsonMatch[0]);
    const hazardLandmarks: Array<{name:string,x:number|null,y:number|null}> = hazardData.landmarks || [];

    // --- Step3: 対応点を収集してアフィン変換行列を計算 ---
    // ゼンリンとハザードで共通して見つかったランドマークのみ使用
    const correspondences: Array<{zx:number,zy:number,hx:number,hy:number}> = [];
    for (const zl of zenrinLandmarks) {
      const hl = hazardLandmarks.find(h => h.name === zl.name && h.x !== null && h.y !== null);
      if (hl && hl.x !== null && hl.y !== null) {
        correspondences.push({ zx: zl.x, zy: zl.y, hx: hl.x, hy: hl.y });
      }
    }

    console.log(`[HazardLandmark] 対応点数: ${correspondences.length}`);

    if (correspondences.length < 3) {
      // 対応点が少ない場合は単純な平均オフセットで補正
      if (correspondences.length >= 1) {
        const avgDx = correspondences.reduce((s,c) => s + (c.hx - c.zx), 0) / correspondences.length;
        const avgDy = correspondences.reduce((s,c) => s + (c.hy - c.zy), 0) / correspondences.length;
        const x = Math.min(100, Math.max(0, zenrinRedMark.x + avgDx));
        const y = Math.min(100, Math.max(0, zenrinRedMark.y + avgDy));
        console.log(`[HazardLandmark] オフセット補正: dx=${avgDx.toFixed(1)}, dy=${avgDy.toFixed(1)} → (${x.toFixed(1)}, ${y.toFixed(1)})`);
        return res.json({ x, y, method: 'offset', correspondences: correspondences.length });
      }
      return res.status(500).json({ error: '共通ランドマークが不足しています', correspondences: correspondences.length });
    }

    // アフィン変換: [hx, hy] = A * [zx, zy, 1]^T を最小二乗法で解く
    // 行列形式: Ax = b
    // [zx1 zy1 1] [a]   [hx1]
    // [zx2 zy2 1] [b] = [hx2]  (x方向)
    // [zx3 zy3 1] [c]   [hx3]
    const n = correspondences.length;

    // 最小二乗法で a,b,c を求める（x方向）
    const solveAffine = (src: number[][], dst: number[]): number[] => {
      // 正規方程式 (A^T A) x = A^T b
      let AtA = [[0,0,0],[0,0,0],[0,0,0]];
      let Atb = [0,0,0];
      for (let i = 0; i < src.length; i++) {
        const [s0, s1, s2] = src[i];
        const d = dst[i];
        AtA[0][0] += s0*s0; AtA[0][1] += s0*s1; AtA[0][2] += s0*s2;
        AtA[1][0] += s1*s0; AtA[1][1] += s1*s1; AtA[1][2] += s1*s2;
        AtA[2][0] += s2*s0; AtA[2][1] += s2*s1; AtA[2][2] += s2*s2;
        Atb[0] += s0*d; Atb[1] += s1*d; Atb[2] += s2*d;
      }
      // 3x3逆行列を使って解く
      const det = AtA[0][0]*(AtA[1][1]*AtA[2][2]-AtA[1][2]*AtA[2][1])
                - AtA[0][1]*(AtA[1][0]*AtA[2][2]-AtA[1][2]*AtA[2][0])
                + AtA[0][2]*(AtA[1][0]*AtA[2][1]-AtA[1][1]*AtA[2][0]);
      if (Math.abs(det) < 1e-10) return [0,0,0];
      const inv = [
        [(AtA[1][1]*AtA[2][2]-AtA[1][2]*AtA[2][1])/det, -(AtA[0][1]*AtA[2][2]-AtA[0][2]*AtA[2][1])/det, (AtA[0][1]*AtA[1][2]-AtA[0][2]*AtA[1][1])/det],
        [-(AtA[1][0]*AtA[2][2]-AtA[1][2]*AtA[2][0])/det, (AtA[0][0]*AtA[2][2]-AtA[0][2]*AtA[2][0])/det, -(AtA[0][0]*AtA[1][2]-AtA[0][2]*AtA[1][0])/det],
        [(AtA[1][0]*AtA[2][1]-AtA[1][1]*AtA[2][0])/det, -(AtA[0][0]*AtA[2][1]-AtA[0][1]*AtA[2][0])/det, (AtA[0][0]*AtA[1][1]-AtA[0][1]*AtA[1][0])/det],
      ];
      return [
        inv[0][0]*Atb[0]+inv[0][1]*Atb[1]+inv[0][2]*Atb[2],
        inv[1][0]*Atb[0]+inv[1][1]*Atb[1]+inv[1][2]*Atb[2],
        inv[2][0]*Atb[0]+inv[2][1]*Atb[1]+inv[2][2]*Atb[2],
      ];
    };

    const srcMatrix = correspondences.map(c => [c.zx, c.zy, 1]);
    const [ax, bx, cx] = solveAffine(srcMatrix, correspondences.map(c => c.hx));
    const [ay, by, cy] = solveAffine(srcMatrix, correspondences.map(c => c.hy));

    // ゼンリンの赤い印位置をアフィン変換
    const hx = ax * zenrinRedMark.x + bx * zenrinRedMark.y + cx;
    const hy = ay * zenrinRedMark.x + by * zenrinRedMark.y + cy;
    const x = Math.min(100, Math.max(0, hx));
    const y = Math.min(100, Math.max(0, hy));

    console.log(`[HazardLandmark] アフィン変換結果: ゼンリン赤印(${zenrinRedMark.x},${zenrinRedMark.y}) → ハザード(${x.toFixed(1)},${y.toFixed(1)}), 対応点数=${correspondences.length}`);

    res.json({ x, y, method: 'affine', correspondences: correspondences.length, zenrinRedMark });
  } catch (error: any) {
    console.error('[HazardLandmark] Error:', error.message);
    res.status(500).json({ error: 'AI解析に失敗しました', message: error.message });
  }
});

/**
 * ゼンリン地図とハザードマップから複数ランドマークを抽出し
 * アフィン変換で正確な赤丸位置を特定
 * POST /api/hazard/locate-by-zenrin
 */
router.post('/locate-by-zenrin', upload.fields([
  { name: 'hazard', maxCount: 1 },
  { name: 'zenrin', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const hazardFile = files?.['hazard']?.[0];
    const zenrinFile = files?.['zenrin']?.[0];
    const address = req.body.address || '';

    if (!hazardFile || !zenrinFile) {
      return res.status(400).json({ error: 'ハザードマップとゼンリン地図の両方が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEYが設定されていません' });
    }

    const hazardBase64 = hazardFile.buffer.toString('base64');
    const zenrinBase64 = zenrinFile.buffer.toString('base64');
    const hazardMediaType = 'image/png' as const;
    const zenrinMediaType = (['image/jpeg','image/png','image/gif','image/webp'].includes(zenrinFile.mimetype)
      ? zenrinFile.mimetype : 'image/png') as 'image/jpeg'|'image/png'|'image/gif'|'image/webp';

    const client = new Anthropic({ apiKey });

    // Step1: ゼンリン地図から複数ランドマーク位置 + 物件（赤い印）位置を抽出
    const zenrinMsg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: zenrinMediaType, data: zenrinBase64 },
          },
          {
            type: 'text',
            text: `これはゼンリン地図です。
${address ? `物件住所: ${address}` : ''}

この地図から以下を抽出してください：
1. 地図上に書かれている施設名・道路名・地名などのランドマークを5〜10個
2. 各ランドマークの画像上の位置（左上を(0,0)、右下を(100,100)としたx%, y%）
3. 赤い印（物件マーク）の位置（x%, y%）

必ず以下のJSON形式のみで回答してください：
{
  "landmarks": [
    {"name": "施設名や道路名", "x": 数値, "y": 数値},
    ...
  ],
  "target": {"x": 数値, "y": 数値}
}`,
          },
        ],
      }],
    });

    const zenrinText = zenrinMsg.content[0].type === 'text' ? zenrinMsg.content[0].text.trim() : '';
    console.log(`[HazardLocateByZenrin] ゼンリン解析: ${zenrinText}`);

    const zenrinJsonMatch = zenrinText.match(/\{[\s\S]*\}/);
    if (!zenrinJsonMatch) {
      return res.status(500).json({ error: 'ゼンリン地図の解析に失敗しました', rawAnswer: zenrinText });
    }
    const zenrinData = JSON.parse(zenrinJsonMatch[0]);
    const zenrinLandmarks: Array<{name: string; x: number; y: number}> = zenrinData.landmarks || [];
    const zenrinTarget: {x: number; y: number} = zenrinData.target || { x: 50, y: 50 };

    if (zenrinLandmarks.length < 2) {
      return res.status(500).json({ error: 'ランドマークが不足しています', rawAnswer: zenrinText });
    }

    // Step2: ハザードマップから同じランドマークの位置を抽出
    const landmarkNames = zenrinLandmarks.map(l => l.name).join('、');
    const hazardMsg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: hazardMediaType, data: hazardBase64 },
          },
          {
            type: 'text',
            text: `これはハザードマップの詳細地図です。

以下のランドマークがこの地図上のどこにあるか、それぞれの位置（x%, y%）を答えてください。
左上を(0,0)、右下を(100,100)とします。

ランドマーク一覧: ${landmarkNames}

地図上に見つからないランドマークはnullとしてください。

必ず以下のJSON形式のみで回答してください：
{
  "landmarks": [
    {"name": "施設名", "x": 数値または null, "y": 数値または null},
    ...
  ]
}`,
          },
        ],
      }],
    });

    const hazardText = hazardMsg.content[0].type === 'text' ? hazardMsg.content[0].text.trim() : '';
    console.log(`[HazardLocateByZenrin] ハザード解析: ${hazardText}`);

    const hazardJsonMatch = hazardText.match(/\{[\s\S]*\}/);
    if (!hazardJsonMatch) {
      return res.status(500).json({ error: 'ハザードマップの解析に失敗しました', rawAnswer: hazardText });
    }
    const hazardData = JSON.parse(hazardJsonMatch[0]);
    const hazardLandmarks: Array<{name: string; x: number|null; y: number|null}> = hazardData.landmarks || [];

    // Step3: 共通ランドマークでアフィン変換行列を計算
    const pairs: Array<{zx: number; zy: number; hx: number; hy: number}> = [];
    for (const zl of zenrinLandmarks) {
      const hl = hazardLandmarks.find(h => h.name === zl.name);
      if (hl && hl.x !== null && hl.y !== null) {
        pairs.push({ zx: zl.x, zy: zl.y, hx: hl.x, hy: hl.y });
      }
    }

    console.log(`[HazardLocateByZenrin] 対応点数: ${pairs.length}`);

    let resultX = 50, resultY = 50;

    if (pairs.length >= 3) {
      // 最小二乗法でアフィン変換 [hx, hy] = A * [zx, zy, 1]
      // 簡易実装: 重み付き平均による補間
      const n = pairs.length;
      let sumZx = 0, sumZy = 0, sumHx = 0, sumHy = 0;
      let sumZxZx = 0, sumZxZy = 0, sumZyZy = 0;
      let sumZxHx = 0, sumZyHx = 0, sumZxHy = 0, sumZyHy = 0;
      for (const p of pairs) {
        sumZx += p.zx; sumZy += p.zy; sumHx += p.hx; sumHy += p.hy;
        sumZxZx += p.zx * p.zx; sumZxZy += p.zx * p.zy; sumZyZy += p.zy * p.zy;
        sumZxHx += p.zx * p.hx; sumZyHx += p.zy * p.hx;
        sumZxHy += p.zx * p.hy; sumZyHy += p.zy * p.hy;
      }
      // アフィン変換: hx = a*zx + b*zy + c, hy = d*zx + e*zy + f
      // 正規方程式を解く（3x3連立方程式）
      const A = [
        [sumZxZx, sumZxZy, sumZx],
        [sumZxZy, sumZyZy, sumZy],
        [sumZx,   sumZy,   n    ],
      ];
      const bx = [sumZxHx, sumZyHx, sumHx];
      const by = [sumZxHy, sumZyHy, sumHy];

      // ガウス消去法
      const solve = (mat: number[][], b: number[]): number[] => {
        const m = mat.map((row, i) => [...row, b[i]]);
        for (let i = 0; i < 3; i++) {
          let maxRow = i;
          for (let k = i+1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
          [m[i], m[maxRow]] = [m[maxRow], m[i]];
          for (let k = i+1; k < 3; k++) {
            const f = m[k][i] / m[i][i];
            for (let j = i; j <= 3; j++) m[k][j] -= f * m[i][j];
          }
        }
        const x = [0, 0, 0];
        for (let i = 2; i >= 0; i--) {
          x[i] = m[i][3];
          for (let j = i+1; j < 3; j++) x[i] -= m[i][j] * x[j];
          x[i] /= m[i][i];
        }
        return x;
      };

      const [a, b, c] = solve(A, bx);
      const [d, e, f] = solve(A, by);

      resultX = a * zenrinTarget.x + b * zenrinTarget.y + c;
      resultY = d * zenrinTarget.x + e * zenrinTarget.y + f;
      resultX = Math.min(100, Math.max(0, resultX));
      resultY = Math.min(100, Math.max(0, resultY));
      console.log(`[HazardLocateByZenrin] アフィン変換結果: x=${resultX.toFixed(1)}, y=${resultY.toFixed(1)}`);
    } else if (pairs.length >= 1) {
      // 対応点が少ない場合は平均オフセットで補正
      const avgOffsetX = pairs.reduce((s, p) => s + (p.hx - p.zx), 0) / pairs.length;
      const avgOffsetY = pairs.reduce((s, p) => s + (p.hy - p.zy), 0) / pairs.length;
      resultX = Math.min(100, Math.max(0, zenrinTarget.x + avgOffsetX));
      resultY = Math.min(100, Math.max(0, zenrinTarget.y + avgOffsetY));
      console.log(`[HazardLocateByZenrin] オフセット補正: x=${resultX.toFixed(1)}, y=${resultY.toFixed(1)}`);
    }

    res.json({
      x: resultX,
      y: resultY,
      pairsCount: pairs.length,
      zenrinTarget,
      rawZenrin: zenrinText,
      rawHazard: hazardText,
    });
  } catch (error: any) {
    console.error('[HazardLocateByZenrin] Error:', error.message);
    res.status(500).json({ error: 'AI解析に失敗しました', message: error.message });
  }
});

export default router;
