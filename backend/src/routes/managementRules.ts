import { Router, Request, Response } from 'express';
import axios from 'axios';

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY が設定されていません' });
    }

    // チェック項目リスト
    const itemsList = CHECK_ITEMS.map((item) => `"${item.key}"`).join(', ');
    const itemsDetail = CHECK_ITEMS.map((item) => `- "${item.key}": ${item.label}`).join('\n');

    // システムプロンプト（JSON出力を強制）
    const systemPrompt = `あなたはマンション管理規約の専門家です。
ユーザーが送る管理規約の画像を読み取り、指定された項目の条文を抽出します。
必ず以下のJSON形式のみで応答してください。説明文・前置き・コードブロック記号は一切不要です。

応答形式（これ以外は絶対に出力しない）:
{"pets":null,"piano":null,"flooring":null,"renovation":null,"sublease":null,"parking":null,"balcony":null,"noise":null,"garbage":null,"subletting":null,"smoking":null,"signage":null}

各keyに該当条文があれば文字列、なければnullを入れてください。`;

    // ユーザープロンプト
    const userPrompt = `以下の管理規約画像から、各項目の条文を抽出してJSONで返してください。

【抽出するkey一覧】
${itemsDetail}

【ルール】
- 条文番号（第○条）とページ番号を含めること
- 原文に近い形で記載すること
- 見つからない場合はnull
- JSON以外は出力しないこと`;

    // OpenAI Vision用のコンテンツブロックを構築
    const contentBlocks: any[] = [
      { type: 'text', text: userPrompt },
    ];

    // 画像ブロックを追加（PDFはOpenAI Visionでは非対応のため画像のみ）
    for (const file of files) {
      if (file.mimeType !== 'application/pdf') {
        contentBlocks.push({
          type: 'image_url',
          image_url: {
            url: `data:${file.mimeType};base64,${file.base64}`,
            detail: 'high',
          },
        });
      } else {
        // PDFの場合はテキストで通知
        contentBlocks.push({
          type: 'text',
          text: `[PDFファイル "${file.name}" が添付されています。このファイルの内容を解析してください。]`,
        });
      }
    }

    // OpenAI Vision APIに送信
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    const responseText = (response.data?.choices?.[0]?.message?.content || '').trim();
    console.log('[management-rules] raw response (first 300):', responseText.substring(0, 300));
    console.log('[management-rules] finish_reason:', response.data?.choices?.[0]?.finish_reason);
    console.log('[management-rules] image count:', files.length);

    let extractedData: Record<string, string | null> = {};

    // パターン1: ```json ... ``` ブロック
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    // パターン2: { ... } を直接抽出
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);

    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (jsonStr) {
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[management-rules] JSON parse error:', parseError, 'raw:', jsonStr);
        return res.status(500).json({
          error: 'AIの応答をパースできませんでした',
          rawResponse: responseText,
        });
      }
    } else {
      // JSONが見つからない場合（画像が読めなかった等）は全項目nullで返す
      // エラーにせず空結果として処理することでチャンク処理を継続できる
      console.warn('[management-rules] No JSON found in response:', responseText.substring(0, 200));
      extractedData = {};
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
    console.error('管理規約解析エラー:', error?.response?.data || error.message);

    // OpenAIのレート制限エラーは429で返す（フロントエンドがリトライできるように）
    const isRateLimit =
      error?.response?.status === 429 ||
      error?.response?.data?.error?.code === 'rate_limit_exceeded';

    if (isRateLimit) {
      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'APIのレート制限に達しました。しばらく待ってから再試行します。',
        },
      });
    }

    return res.status(500).json({
      error: error?.response?.data?.error?.message || error.message || '解析中にエラーが発生しました',
    });
  }
});

export default router;
