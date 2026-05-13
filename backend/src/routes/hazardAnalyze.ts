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

    // 画像をbase64に変換
    const imageBase64 = file.buffer.toString('base64');
    const mediaType = (file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/jpeg';

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 256,
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
              text: `これはハザードマップの索引図です。
地図上には番号付きのエリア（1、2、3、4、5など）が区画されています。

以下の座標がこの索引図のどの番号のエリアに該当するか教えてください。

緯度: ${lat}
経度: ${lng}

回答は番号のみ（例: 2）を返してください。
番号が判断できない場合は「不明」と返してください。
余計な説明は不要です。番号だけ答えてください。`,
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
      max_tokens: 256,
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
              text: `これはハザードマップの詳細地図画像です。

以下の座標がこの地図上のどの位置にあるか特定してください。

緯度: ${lat}
経度: ${lng}

この地図画像の左上を(0,0)、右下を(100,100)としたとき、
上記座標が地図上のどの位置（x%, y%）にあるかを答えてください。

必ず以下のJSON形式のみで回答してください（説明不要）:
{"x": 数値, "y": 数値}

例: {"x": 65.5, "y": 42.3}

地図の範囲外や判断できない場合は {"x": 50, "y": 50} を返してください。`,
            },
          ],
        },
      ],
    });

    const resultText = message.content[0].type === 'text' ? message.content[0].text.trim() : '{"x":50,"y":50}';
    console.log(`[HazardLocate] lat=${lat}, lng=${lng} → Claude回答: "${resultText}"`);

    // JSONを抽出
    const jsonMatch = resultText.match(/\{[^}]+\}/);
    let x = 50, y = 50;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        x = typeof parsed.x === 'number' ? Math.min(100, Math.max(0, parsed.x)) : 50;
        y = typeof parsed.y === 'number' ? Math.min(100, Math.max(0, parsed.y)) : 50;
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

export default router;
