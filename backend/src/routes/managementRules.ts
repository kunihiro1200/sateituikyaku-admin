import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// チェック項目の定義（表示順）
const CHECK_ITEMS = [
  { key: 'usage_restriction', label: '用途制限' },
  { key: 'pets', label: 'ペットの飼育' },
  { key: 'piano', label: 'ピアノ・楽器の使用' },
  { key: 'flooring', label: 'フローリング張替え工事' },
  { key: 'renovation', label: 'リフォーム・改修工事全般' },
  { key: 'balcony_exclusive', label: '専用使用権 - バルコニー' },
  { key: 'parking_exclusive', label: '専用使用権 - 専用駐車場' },
  { key: 'bicycle_exclusive', label: '専用使用権 - 専用駐輪場' },
  { key: 'garden_exclusive', label: '専用使用権 - 専用庭' },
  { key: 'storage_exclusive', label: '専用使用権 - 専用倉庫' },
  { key: 'sublease', label: '民泊・短期賃貸（Airbnb等）' },
  { key: 'parking', label: '駐車場・駐輪場の利用' },
  { key: 'noise', label: '騒音・生活音の制限' },
  { key: 'garbage', label: 'ゴミ出しルール' },
  { key: 'subletting', label: '専有部分の第三者への貸与' },
];

/**
 * POST /api/management-rules/analyze
 * 管理規約のPDF/画像を解析して項目ごとの条文を抽出
 *
 * リクエスト形式: JSON { files: [{ name, mimeType, base64 }] }
 * - PDFはそのままClaudeに送信（画像変換不要）
 * - 画像（JPEG/PNG等）もそのまま送信
 * - テキストPDF・スキャンPDF両方対応
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

    // チェック項目リスト
    const itemsDetail = CHECK_ITEMS.map((item) => `- "${item.key}": ${item.label}`).join('\n');

    // コンテンツブロックを構築
    const contentBlocks: Anthropic.ContentBlockParam[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/pdf') {
        // PDFはdocumentタイプで直接送信（テキストPDF・スキャンPDF両方対応）
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        } as any);
      } else {
        // 画像ファイル
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

    // プロンプトを追加
    contentBlocks.push({
      type: 'text',
      text: `あなたはマンション管理規約の専門家です。
添付された管理規約の文書を読み取り、以下の各項目について該当する条文を抽出してください。

【抽出するkey一覧】
${itemsDetail}

【重要ルール】
1. 条文番号（第○条）とページ番号を含めること
2. 原文に近い形で記載すること
3. 「第○条に基づき〜」のような参照がある場合は、参照先の条文内容も合わせて記載すること
4. 「別表第○」「別表○」が参照されている場合：
   - 必ずその別表を探して、表の全内容をMarkdown形式で記載すること
   - Markdown表の書き方: 1行目にヘッダー、2行目に「|---|---|」、3行目以降にデータ
   - 例：
     第14条の規定による。

     | 専用使用部分 | 位置 | 専用使用権者 |
     |---|---|---|
     | バルコニー | 各住戸に接する | 各住戸の区分所有者 |
     | 玄関扉・窓枠・窓ガラス | 各住戸に付属する | 各住戸の区分所有者 |
     | 自転車置場 | 位置図の通り | 各住戸の区分所有者 |
     | 駐車場 | 位置図の通り | 各住戸の区分所有者 |
   - 別表が見つからない場合のみ「（別表第○ 参照）」と付記すること
5. 見つからない場合はnull
6. 必ず以下のJSON形式のみで応答すること（説明文・コードブロック記号は不要）

{"usage_restriction":null,"pets":null,"piano":null,"flooring":null,"renovation":null,"balcony_exclusive":null,"parking_exclusive":null,"bicycle_exclusive":null,"garden_exclusive":null,"storage_exclusive":null,"sublease":null,"parking":null,"noise":null,"garbage":null,"subletting":null}`,
    });

    // Claude APIに送信（PDF直接対応）
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

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '';

    console.log('[management-rules] Claude response (first 300):', responseText.substring(0, 300));
    console.log('[management-rules] stop_reason:', response.stop_reason);

    let extractedData: Record<string, string | null> = {};

    // JSONを抽出（コードブロックあり・なし両対応）
    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (jsonStr) {
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[management-rules] JSON parse error:', parseError);
        // パース失敗でも空結果として返す（エラーにしない）
        extractedData = {};
      }
    } else {
      console.warn('[management-rules] No JSON in response:', responseText.substring(0, 200));
      extractedData = {};
    }

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
    console.error('管理規約解析エラー:', error?.message || error);

    // Claudeのレート制限
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'APIのレート制限に達しました。しばらく待ってから再試行します。',
        },
      });
    }

    return res.status(500).json({
      error: error?.message || '解析中にエラーが発生しました',
    });
  }
});

/**
 * POST /api/management-rules/summarize
 * 条文テキストを要約する
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { label, content } = req.body as { label: string; content: string };

    if (!content) {
      return res.status(400).json({ error: 'content が必要です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY が設定されていません' });
    }

    const axios = (await import('axios')).default;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: 'マンション管理規約の条文を、不動産業者が買主・売主に説明できるよう、3〜5文の平易な日本語で要約してください。専門用語は避け、具体的な制限内容を明確に伝えてください。',
          },
          {
            role: 'user',
            content: `【項目】${label}\n\n【条文】\n${content}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const summary = response.data?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({ summary });

  } catch (error: any) {
    console.error('要約エラー:', error?.response?.data || error.message);
    return res.status(500).json({ error: '要約に失敗しました' });
  }
});

export default router;
