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

export default router;
