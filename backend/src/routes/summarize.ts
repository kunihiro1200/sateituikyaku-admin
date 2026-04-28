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
売主との通話・対応のコメントを読んで、以下の2つを抽出してください。

## 1. クイックボタンカテゴリの抽出（highlights）

以下のカテゴリに「意味的に関連する内容」を全て箇条書きで抽出してください。

【カテゴリと、そのカテゴリに該当するニュアンス例】

B'（売却意欲が低い・価格確認だけ・様子見・興味薄い）
  → 「価格だけ知りたかった」「売るつもりはない」「今は考えていない」「とりあえず聞いてみた」
     「特に売る気はないが相場が気になった」「1年以内に売りたいが今は動かない」なども含む

木造２F（建物の構造・木造・2階建て）
  → 「木造」「2階建て」「木造2階」「古い木造」など

土地面積（土地の実際の広さ・坪数・㎡）
  → 「〇坪」「〇㎡」「だいたい〇坪くらい」「土地が〇平米」など、具体的な面積の数値や概算が書かれている場合のみ該当
  ※「面積を確認する」「メールで教えてもらう」「確認中」など、面積の数値が不明な場合は該当しない
  ※価格・査定額・予想価格などの金額情報は土地面積ではないので該当しない

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
  ※「名義」「所有者」「名義人」「共有名義」「相続」という言葉が含まれる場合のみ該当。家族が住んでいるという情報だけでは該当しない

ローン（住宅ローン残債・残高・完済）
  → 「ローンが残っている」「残債〇万」「完済済み」「ローンなし」など
  ※「ローン」「ローン残」「残債」「完済」という言葉が含まれる場合のみ該当。家族の居住状況や退去予定などはローンと無関係なので該当しない

売却意欲あり（売りたい・前向き・具体的に検討中）
  → 「売りたい」「前向きに検討」「早めに売りたい」「具体的に動きたい」「〇年以内に売却予定」など

キャンセル案内（解約・キャンセルの説明をした）
  → 「キャンセルの説明をした」「解約について話した」「契約解除の案内」など

譲渡所得税（税金・確定申告・譲渡益・節税）
  → 「税金の話をした」「譲渡所得税を説明」「確定申告が必要」「節税について」など

買主紹介（買いたいお客様がいる・紹介できる・紹介OK）
  → 「買いたいお客様がいる」「紹介できるお客様がいる」「この辺で探している方がいる」「お客様紹介：済」「紹介OK」「紹介してほしいとのこと」「ご紹介は控えたほうが良いですよね」など
  ※売主がお客様紹介に同意・了承している場合は「お客様紹介：済　紹介OK」として出力する

当社紹介済み（すでに当社から紹介した）
  → 「当社から紹介済み」「すでに紹介した」など

【highlightsの出力ルール】
- 上記カテゴリに「意味的に近いニュアンス」があれば積極的に抽出する
- 直接的な表現でなくても、文脈から読み取れるものは含める
- 各項目は「カテゴリ名：コメントから読み取れる具体的な内容」の形式で出力
- 「買主紹介」カテゴリに該当する場合は必ず「買主紹介：済　紹介OK」の形式で出力する
- 該当するカテゴリが複数あれば全て出力する（上限なし）
- 関連する内容が全くなければ空配列を返す

## 2. その他の内容の時系列要約（other_summary）

上記クイックボタンカテゴリに分類されなかった内容（入院・体調・家族の状況・次回連絡の約束・特記事項など）を時系列順（古い順）に箇条書きで要約してください。

【other_summaryの出力ルール】
- クイックボタンカテゴリ（B'・木造２F・土地面積・太陽光・机上査定・他社待ち・査定額への反応・名義・ローン・売却意欲あり・キャンセル案内・譲渡所得税・買主紹介・当社紹介済み）に該当する内容は含めない
- 売却希望時期・売却希望価格・残債・希望連絡方法・面積確認中などの情報は【その他】に含める
- 日付がある場合は「YYYY/M/D：内容」の形式で出力する
- 重複する内容はまとめる
- 重要な出来事・状況変化・次回アクションに関する内容を優先する
- 該当する内容がなければ空配列を返す
- 1項目あたり30文字以内で簡潔にまとめる

## 出力形式
必ず以下のJSON形式で返す：
{"highlights": [...], "other_summary": [...]}
例: {"highlights": ["B'：価格だけ知りたかった様子", "他社待ち：他社の査定結果を待っている"], "other_summary": ["2024/1/22：連絡が取れないため追客不要", "2023/7/16：入院中、28日まで"]}`;

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
    let otherSummary: string[] = [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        highlights = parsed;
      } else if (Array.isArray(parsed.highlights)) {
        highlights = parsed.highlights;
        otherSummary = Array.isArray(parsed.other_summary) ? parsed.other_summary : [];
      } else {
        const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
        if (firstArray) highlights = firstArray as string[];
      }
    } catch (e) {
      console.error('[comment-highlights] JSON parse error:', e, raw);
    }

    return res.json({ highlights, other_summary: otherSummary });
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
    const enhanceMode: 'light' | 'rewrite' = mode === 'rewrite' ? 'rewrite' : 'light';

    if (!currentBody || typeof currentBody !== 'string' || currentBody.trim().length === 0) {
      return res.status(400).json({ error: 'currentBody は必須です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[enhance-email] OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const historySection = Array.isArray(previousBodies) && previousBodies.length > 0
      ? `【過去に送った本文（直近${previousBodies.length}件）】\n` +
        previousBodies.map((b, i) => `--- 過去${i + 1}回目 ---\n${b}`).join('\n\n')
      : '（過去の送信履歴なし）';

    const systemPrompt = enhanceMode === 'rewrite'
      ? `あなたは不動産会社の担当者です。売主との関係を大切にしながら、温かみのある丁寧なメールを書くのが得意です。
以下の売主への報告メールを、同じ情報を伝えながら「全く別の人が書いたような文章」に書き直してください。

【トーンについて】
- ビジネスメールとして礼儀正しいが、堅苦しくなりすぎない
- 売主との距離感を縮めるような、温かみのある表現を使う
- 「〜でございます」より「〜です・〜ます」調を基本にする
- 読んでいて自然に伝わる、話しかけるような柔らかさを意識する

【必須条件】
- 元の文章の単語・フレーズを極力使わない（別の言葉に置き換える）
- 冒頭の挨拶はビジネスメールとして適切な表現にする（「お世話になっております」「いつもお世話になっております」などの範囲で変える。「こんにちは」などカジュアルすぎる表現は使わない）
- 段落の構成・順序を変える
- 伝える情報・事実・趣旨は元の本文と完全に同じにする
- 語尾を省略しない（「思います」「考えています」など最後まで書く）
- 署名部分（「---」以降や名前・会社名・電話番号など）は一切変更しない
- 書き直した本文のみを返す（説明・コメント・前置き不要）

【文章量について】
- 元の本文より1.5〜2倍程度の文章量にする
- 背景・理由・補足説明・今後の流れなどを丁寧に加筆して膨らませる
- ただし無駄な繰り返しや冗長な表現は避け、読んで意味のある内容を追加する

【重要】元の文章をベースに少し変えるのではなく、ゼロから書き直すイメージで作成してください。`
      : `あなたは不動産会社の担当者です。売主との関係を大切にしながら、温かみのある丁寧なメールを書くのが得意です。
売主への報告メールの本文を、自然で読みやすい日本語に改善してください。

【トーンについて】
- ビジネスメールとして礼儀正しいが、堅苦しくなりすぎない
- 「〜でございます」より「〜です・〜ます」調を基本にする
- 読んでいて自然に伝わる、柔らかさを意識する

【ルール】
- 元の本文の意味・内容・構成は変えない
- 過去に送った本文と同じ表現・言い回しにならないよう、ニュアンスや言葉を変える
- 文章の長さは元の本文と同程度にする
- 語尾を省略しない（「思います」など最後まで書く）
- 署名部分（「---」以降や名前・会社名など）は変更しない
- 改行・段落構成は元の本文に合わせる
- 改善した本文のみを返す（説明文・コメント不要）`;

    const userMessage = enhanceMode === 'rewrite'
      ? `${historySection}

【今回の本文（書き直してください）】
${currentBody}

---
上記の本文は約${currentBody.length}文字です。
書き直し後は必ず${Math.floor(currentBody.length * 1.5)}文字以上、できれば${currentBody.length * 2}文字程度になるよう、内容を丁寧に膨らませてください。`
      : `${historySection}

【今回の本文（改善してください）】
${currentBody}`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: enhanceMode === 'rewrite' ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: enhanceMode === 'rewrite' ? 1.0 : 0.7,
        max_tokens: enhanceMode === 'rewrite' ? 2500 : 1500,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
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

