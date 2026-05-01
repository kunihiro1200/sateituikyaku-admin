import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// チェック項目の定義
const CHECK_ITEMS = [
  { key: 'pets', label: 'ペットの飼育' },
  { key: 'piano', label: 'ピアノ・楽器の使用' },
  { key: 'flooring', label: 'フローリング張替え工事' },
  { key: 'renovation', label: 'リフォーム・改修工事全般' },
  { key: 'sublease', label: '民泊・短期賃貸（Airbnb等）' },
  { key: 'parking', label: '駐車場・駐輪場の利用' },
  { key: 'balcony', label: 'バルコニー・ベランダの使用制限' },
  { key: 'noise', label: '騒音・生活音の制限' },
  { key: 'garbage', label: 'ゴミ出しルール' },
  { key: 'subletting', label: '専有部分の第三者への貸与' },
  { key: 'smoking', label: '喫煙ルール' },
  { key: 'signage', label: '看板・広告物の掲示' },
];

/**
 * POST /api/management-rules/analyze
 * 管理規約の画像/PDFを解析して項目ごとの条文を抽出
 * リクエスト形式: JSON { files: [{ name, mimeType, base64 }] }
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { files } = req.body as {
      files: Array<{ name: string; mimeType: string; base64: string }>;
    };

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
    }

    const client = new Anthropic({ apiKey });

    // コンテンツブロックを構築
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/pdf') {
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        } as any);
      } else {
        const mediaType = file.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: file.base64,
          },
        });
      }
    }

    // チェック項目リストをプロンプトに含める
    const itemsList = CHECK_ITEMS.map((item) => `- ${item.key}: ${item.label}`).join('\n');

    contentBlocks.push({
      type: 'text',
      text: `あなたはマンション管理規約の専門家です。
添付された管理規約の画像/文書を読み取り、以下の各項目について該当する条文を抽出してください。

【チェック項目（keyとラベル）】
${itemsList}

【出力形式】
以下のJSON形式のみを出力してください。該当する条文が見つかった場合はその内容を、見つからない場合は null を返してください。

\`\`\`json
{
  "pets": "第○条 区分所有者はペットは小型犬２匹までとなっています（○ページ）",
  "piano": null,
  "flooring": "第○条 ...",
  "renovation": "第○条 ...",
  "sublease": null,
  "parking": "第○条 ...",
  "balcony": null,
  "noise": "第○条 ...",
  "garbage": null,
  "subletting": "第○条 ...",
  "smoking": null,
  "signage": null
}
\`\`\`

【注意事項】
- 条文番号（第○条）とページ番号を必ず含めてください
- 条文の内容は要約せず、できるだけ原文に近い形で記載してください
- 複数の条文が関連する場合は、最も重要な条文を記載してください
- 日本語で回答してください
- JSONコードブロックのみを出力し、前後に説明文を付けないでください`,
    });

    // Claude APIに送信
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // レスポンスからJSONを抽出
    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // JSONブロックを抽出
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
    let extractedData: Record<string, string | null> = {};

    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({
          error: 'AIの応答をパースできませんでした',
          rawResponse: responseText,
        });
      }
    } else {
      // JSONブロックがない場合、直接パースを試みる
      try {
        extractedData = JSON.parse(responseText);
      } catch {
        return res.status(500).json({
          error: 'AIの応答にJSONが含まれていませんでした',
          rawResponse: responseText,
        });
      }
    }

    // チェック項目のラベルと結合して返す
    const results = CHECK_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      content: extractedData[item.key] ?? null,
      found: extractedData[item.key] != null,
    }));

    return res.json({
      success: true,
      fileCount: files.length,
      results,
    });
  } catch (error: any) {
    console.error('管理規約解析エラー:', error);
    return res.status(500).json({
      error: error.message || '解析中にエラーが発生しました',
    });
  }
});

export default router;
