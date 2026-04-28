import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { SummaryGenerator } from '../services/SummaryGenerator';
import { ActivityLogService } from '../services/ActivityLogService';
import { SellerService } from '../services/SellerService.supabase';
import axios from 'axios';

const router = Router();
const summaryGenerator = new SummaryGenerator();
const activityLogService = new ActivityLogService();
const sellerService = new SellerService();

/**
 * 通話メモを要約（拡張版）
 * 
 * Supports both old format (memos array) and new format (structured data)
 */
router.post('/call-memos', authenticate, async (req: Request, res: Response) => {
  try {
    const { memos, communicationHistory, spreadsheetComments, sellerData } = req.body;

    // Backward compatibility: support old format with memos array
    if (memos && Array.isArray(memos)) {
      if (memos.length === 0) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Memos are required',
            retryable: false,
          },
        });
      }

      // Use new generator with backward compatible method
      const summary = summaryGenerator.generateSimpleSummary(memos);
      return res.json({ summary });
    }

    // New format: structured data
    if (!communicationHistory && !spreadsheetComments) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either memos, communicationHistory, or spreadsheetComments are required',
          retryable: false,
        },
      });
    }

    // Generate enhanced summary
    const result = summaryGenerator.generateEnhancedSummary({
      communicationHistory: communicationHistory || [],
      spreadsheetComments: spreadsheetComments || [],
      sellerData: sellerData || {},
    });

    return res.json({
      summary: result.summary,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Summarization error:', error);
    return res.status(500).json({
      error: {
        code: 'SUMMARIZATION_ERROR',
        message: 'Failed to summarize memos',
        retryable: true,
      },
    });
  }
});

/**
 * 売主の通話履歴サマリーを生成（統合版）
 * 
 * Fetches data from ActivityLogService and SellerService, then generates summary
 */
router.get('/seller/:sellerId', authenticate, async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Seller ID is required',
          retryable: false,
        },
      });
    }

    // Fetch seller data
    const seller = await sellerService.getSeller(sellerId);
    if (!seller) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Seller not found',
          retryable: false,
        },
      });
    }

    // Fetch communication history (limit to 200 most recent entries)
    const activityLogs = await activityLogService.getLogs({
      sellerId,
    });

    // Extract spreadsheet comments from seller.comments field
    const spreadsheetComments: string[] = [];
    const sellerComments = (seller as any).comments;
    if (sellerComments) {
      // Parse comments field - assuming it's stored as JSON array or newline-separated
      try {
        if (typeof sellerComments === 'string') {
          // Try parsing as JSON first
          try {
            const parsed = JSON.parse(sellerComments);
            if (Array.isArray(parsed)) {
              spreadsheetComments.push(...parsed);
            } else {
              // Split by newlines if not JSON
              spreadsheetComments.push(...sellerComments.split('\n').filter((c: string) => c.trim()));
            }
          } catch {
            // Split by newlines if JSON parse fails
            spreadsheetComments.push(...sellerComments.split('\n').filter((c: string) => c.trim()));
          }
        } else if (Array.isArray(sellerComments)) {
          spreadsheetComments.push(...sellerComments);
        }
      } catch (error) {
        console.warn('Failed to parse seller comments:', error);
      }
    }

    // Limit to 200 most recent entries for performance
    const limitedActivityLogs = activityLogs.slice(0, 200);

    // Generate enhanced summary
    const result = summaryGenerator.generateEnhancedSummary({
      communicationHistory: limitedActivityLogs,
      spreadsheetComments,
      sellerData: {
        name: seller.name,
        status: seller.status,
        confidence: seller.confidenceLevel,
        assignedTo: seller.assignedTo,
      },
    });

    return res.json({
      summary: result.summary,
      metadata: result.metadata,
      seller: {
        id: seller.id,
        name: seller.name,
        status: seller.status,
      },
    });
  } catch (error) {
    console.error('Seller summary generation error:', error);
    return res.status(500).json({
      error: {
        code: 'SUMMARIZATION_ERROR',
        message: 'Failed to generate seller summary',
        retryable: true,
      },
    });
  }
});

/**
 * コメントからクイックボタン関連項目をAIで抽出
 * POST /summarize/comment-highlights
 * body: { commentText: string }
 * response: { highlights: string[] }
 */
router.post('/comment-highlights', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentText } = req.body;

    if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
      return res.json({ highlights: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[comment-highlights] OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // HTMLタグを除去してプレーンテキストに変換
    const plainText = commentText.replace(/<[^>]+>/g, '').trim();

    if (plainText.length === 0) {
      return res.json({ highlights: [] });
    }
    const systemPrompt = `あなたは不動産売主管理システムのアシスタントです。
売主との通話・対応のコメントを読んで、以下のカテゴリに「意味的に関連する内容」を全て箇条書きで抽出してください。

【カテゴリと、そのカテゴリに該当するニュアンス例】

B'（売却意欲が低い・価格確認だけ・様子見・興味薄い）
  → 「価格だけ知りたかった」「売るつもりはない」「今は考えていない」「とりあえず聞いてみた」
     「特に売る気はないが相場が気になった」「1年以内に売りたいが今は動かない」なども含む

木造２F（建物の構造・木造・2階建て）
  → 「木造」「2階建て」「木造2階」「古い木造」など

土地面積（土地の広さ・坪数・㎡・面積）
  → 「土地が広い」「〇坪」「〇㎡」「だいたい〇坪くらい」など

太陽光（太陽光パネル・ソーラー発電）
  → 「太陽光がある」「ソーラーパネル付き」「売電している」など

机上査定（まず概算で・訪問前に査定・机上で確認）
  → 「まず机上で」「訪問前に概算を」「一旦金額だけ」「訪問は後で考える」など

他社待ち（他社の査定を待っている・複数社比較中）
  → 「他社の結果待ち」「他にも頼んでいる」「複数社に依頼中」「他社と比べてから」など

査定額への反応（査定額に対する感想・高い・安い・驚いた）
  → 「思ったより高かった」「安すぎる」「想定外の金額」「驚いていた」など

名義（所有者・名義人・共有名義・相続）
  → 「本人名義」「共有名義」「相続した」「名義が複数」「夫婦共有」など

ローン（住宅ローン残債・残高・完済）
  → 「ローンが残っている」「残債〇万」「完済済み」「ローンなし」など

売却意欲あり（売りたい・前向き・具体的に検討中）
  → 「売りたい」「前向きに検討」「早めに売りたい」「具体的に動きたい」「〇年以内に売却予定」など

不通（電話がつながらない・留守・不在・折り返しなし）
  → 「電話に出ない」「留守電」「折り返しなし」「何度かけてもつながらない」など

キャンセル案内（解約・キャンセルの説明をした）
  → 「キャンセルの説明をした」「解約について話した」「契約解除の案内」など

譲渡所得税（税金・確定申告・譲渡益・節税）
  → 「税金の話をした」「譲渡所得税を説明」「確定申告が必要」「節税について」など

買主紹介（買いたいお客様がいる・紹介できる）
  → 「買いたいお客様がいる」「紹介できるお客様がいる」「この辺で探している方がいる」など

当社紹介済み（すでに当社から紹介した）
  → 「当社から紹介済み」「すでに紹介した」など

【出力ルール】
- 上記カテゴリに「意味的に近いニュアンス」があれば積極的に抽出する
- 直接的な表現でなくても、文脈から読み取れるものは含める
- 各項目は「カテゴリ名：コメントから読み取れる具体的な内容」の形式で出力
- 該当するカテゴリが複数あれば全て出力する（上限なし）
- 関連する内容が全くなければ空配列を返す
- 必ず {"highlights": [...]} の形式のJSONで返す
- 例: {"highlights": ["B'：価格だけ知りたかった様子で売る気はなさそう", "他社待ち：他社の査定結果を待ってから判断したい", "売却意欲あり：1年以内には売りたいと言っていた"]}`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下のコメントから関連項目を抽出してください：\n\n${plainText}` },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const raw = completion.data?.choices?.[0]?.message?.content || '{}';
    let highlights: string[] = [];

    try {
      const parsed = JSON.parse(raw);
      // { highlights: [...] } または直接配列の両方に対応
      if (Array.isArray(parsed)) {
        highlights = parsed;
      } else if (Array.isArray(parsed.highlights)) {
        highlights = parsed.highlights;
      } else {
        // オブジェクトの最初の配列値を使用
        const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
        if (firstArray) highlights = firstArray as string[];
      }
    } catch (e) {
      console.error('[comment-highlights] JSON parse error:', e, raw);
    }

    return res.json({ highlights });
  } catch (error: any) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data?.error?.message || error.message;
    console.error(`[comment-highlights] Error (HTTP ${status}):`, errMsg);

    if (status === 429) {
      return res.status(429).json({ error: 'rate_limit', highlights: [] });
    }
    if (status === 401) {
      return res.status(401).json({ error: 'invalid_api_key', highlights: [] });
    }
    return res.status(500).json({ error: 'Failed to extract highlights', highlights: [] });
  }
});

/**
 * メール本文をAIで改善・バリエーション生成
 * POST /api/summarize/enhance-email
 * Body: { currentBody: string, previousBodies: string[] }
 */
router.post('/enhance-email', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentBody, previousBodies, mode } = req.body;
    // mode: 'light'（軽微な改善）または 'rewrite'（大幅リライト）、デフォルトは 'light'
    const enhanceMode: 'light' | 'rewrite' = mode === 'rewrite' ? 'rewrite' : 'light';

    if (!currentBody || typeof currentBody !== 'string' || currentBody.trim().length === 0) {
      return res.status(400).json({ error: 'currentBody は必須です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[enhance-email] OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // 過去の送信履歴を整形
    const historySection = Array.isArray(previousBodies) && previousBodies.length > 0
      ? `【過去に送った本文（直近${previousBodies.length}件）】\n` +
        previousBodies.map((b, i) => `--- 過去${i + 1}回目 ---\n${b}`).join('\n\n')
      : '（過去の送信履歴なし）';

    const systemPrompt = enhanceMode === 'rewrite'
      ? `あなたは不動産会社の丁寧なメール文章アシスタントです。
売主への報告メールの本文を、同じ趣旨・内容を保ちながら、全く異なるアプローチで書き直してください。

【ルール】
- 伝える情報・趣旨は元の本文と同じにする
- 文章の構成・切り口・言い回しを大きく変える（例：冒頭の入り方を変える、段落の順序を変える、別の表現で言い換えるなど）
- 敬語・丁寧語を適切に使う
- 過去に送った本文と同じ表現・構成にならないよう意識する
- 署名部分（「---」以降や「よろしくお願いいたします」以降の名前・会社名など）は変更しない
- 書き直した本文のみを返す（説明文・コメント不要）`
      : `あなたは不動産会社の丁寧なメール文章アシスタントです。
売主への報告メールの本文を、自然で読みやすい日本語に改善してください。

【ルール】
- 元の本文の意味・内容・構成は変えない
- 敬語・丁寧語を適切に使う
- 過去に送った本文と同じ表現・言い回しにならないよう、ニュアンスや言葉を変える
- 文章の長さは元の本文と同程度にする
- 署名部分（「---」以降や「よろしくお願いいたします」以降の名前・会社名など）は変更しない
- 改行・段落構成は元の本文に合わせる
- 改善した本文のみを返す（説明文・コメント不要）`;

    const userMessage = `${historySection}

【今回の本文（改善してください）】
${currentBody}`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const enhancedBody = completion.data?.choices?.[0]?.message?.content?.trim() || '';
    if (!enhancedBody) {
      return res.status(500).json({ error: 'AIからの応答が空でした' });
    }

    return res.json({ enhancedBody });
  } catch (error: any) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data?.error?.message || error.message;
    console.error(`[enhance-email] Error (HTTP ${status}):`, errMsg);

    if (status === 429) {
      return res.status(429).json({ error: 'APIの利用制限に達しました。しばらく待ってから再試行してください。' });
    }
    if (status === 401) {
      return res.status(401).json({ error: 'OpenAI APIキーが無効です。' });
    }
    return res.status(500).json({ error: 'メール改善に失敗しました' });
  }
});

export default router;

