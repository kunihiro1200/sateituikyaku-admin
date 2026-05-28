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

確度（売却意欲の度合い・売る気の強さ・温度感）
  → 「価格だけ知りたかった」「売るつもりはない」「今は考えていない」「とりあえず聞いてみた」
     「特に売る気はないが相場が気になった」「1年以内に売りたいが今は動かない」
     「売りたい」「前向きに検討」「早めに売りたい」「具体的に動きたい」「〇年以内に売却予定」なども含む

構造（建物の構造・工法・階数）
  → 「木造」「軽量鉄骨」「鉄骨」「RC造」「2階建て」「木造2階」「軽鉄」「重量鉄骨」など

土地面積（土地の実際の広さ・坪数・㎡の数値）
  → コメント中に「〇坪」「〇㎡」「〇平米」など具体的な面積の数値が明記されている場合のみ該当
  ※絶対に該当しないケース：「面積を確認する」「メールで教えてもらう」「確認中」「予想価格」「査定額」「〜万円」「価格」など。数値の面積が書かれていない場合は絶対にこのカテゴリに入れない

太陽光（太陽光パネル・ソーラー発電）
  → 「太陽光がある」「ソーラーパネル付き」「売電している」など

机上査定（まず概算で・訪問前に査定・机上で確認）
  → 「まず机上で」「訪問前に概算を」「一旦金額だけ」「訪問は後で考える」など

他社待ち（他社の査定を待っている・複数社比較中）
  → 「他社の結果待ち」「他にも頼んでいる」「複数社に依頼中」「他社と比べてから」など

査定額への反応（査定額に対する感想・高い・安い・驚いた）
  → 「思ったより高かった」「安すぎる」「想定外の金額」「驚いていた」など

名義（売却対象物件の所有者・名義人・登記名義）
  → 「本人名義」「共有名義」「相続した」「名義が複数」「夫婦共有」「〇〇名義」「名義人は〇〇」など
  ※必ず「誰が所有者・名義人か」という情報のみ該当
  ※絶対に該当しないケース：「〇〇が住んでいる」「〇〇が居住中」など居住者・同居者の情報。誰が住んでいるかは名義とは無関係なので該当しない
  ※「名義」「所有者」「名義人」「共有名義」「相続」という言葉が含まれる場合のみ該当

ローン（売却対象物件のローン残債・残高・完済状況）
  → 「ローンが残っている」「残債〇万」「完済済み」「ローンなし」「残債がある」など
  ※必ず「売却対象の物件」に対するローン残債・残高・完済状況の情報のみ該当
  ※絶対に該当しないケース：別の土地・別の物件・アパート・建て替え予定・投資物件など「売却対象以外」に関するローンや資金計画。居住状況・退去予定・家族の状況もローンと無関係なので該当しない

キャンセル案内（解約・キャンセルの説明をした）
  → 「キャンセルの説明をした」「解約について話した」「契約解除の案内」など

譲渡所得税（税金・確定申告・譲渡益・節税）
  → 「税金の話をした」「譲渡所得税を説明」「確定申告が必要」「節税について」など

買主紹介（買いたいお客様がいる・紹介できる・紹介OK）
  → 「買いたいお客様がいる」「紹介できるお客様がいる」「この辺で探している方がいる」「お客様紹介：済」「紹介OK」「紹介してほしいとのこと」「ご紹介は控えたほうが良いですよね」など
  ※売主がお客様紹介に同意・了承している場合は「お客様紹介：済　紹介OK」として出力する

当社紹介済み（すでに当社から紹介した）
  → 「当社から紹介済み」「すでに紹介した」など

売却理由（売却しようとしている理由・動機）
  → 「住み替え」「離婚」「相続」「転勤」「資金が必要」「老後の資金」「建て替え」「引越し」「手放したい」など
  ※「住み替え」「離婚」「相続」「転勤」はこのカテゴリに必ず該当する

表札確認（表札の有無・確認状況）
  → 「表札はない」「表札がある」「表札を確認した」「表札なし」「表札あり」など
  ※「表札」という文字が含まれる内容は必ずこのカテゴリに該当する

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
- クイックボタンカテゴリ（確度・構造・土地面積・太陽光・机上査定・他社待ち・査定額への反応・名義・ローン・キャンセル案内・譲渡所得税・買主紹介・当社紹介済み・売却理由・表札確認）に該当する内容は含めない
- 「周辺環境」に関する情報（バス停・スーパー・病院・学校・公園・警察署など周辺施設の情報）は絶対に含めない
- 売却希望時期・売却希望価格・残債・希望連絡方法・面積確認中などの情報は【その他】に含める
- 日付がある場合は「YYYY/M/D：内容」の形式で出力する
- 重複する内容はまとめる
- 重要な出来事・状況変化・次回アクションに関する内容を優先する
- 該当する内容がなければ空配列を返す
- 1項目あたり30文字以内で簡潔にまとめる

## 出力形式
必ず以下のJSON形式で返す：
{"highlights": [...], "other_summary": [...]}
例: {"highlights": ["確度：価格だけ知りたかった様子（売る気低め）", "他社待ち：他社の査定結果を待っている"], "other_summary": ["2024/1/22：連絡が取れないため追客不要", "2023/7/16：入院中、28日まで"]}`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `以下のコメントから関連項目を抽出してください：\n\n${plainText}` },
        ],
        temperature: 0.2,
        max_tokens: 700,
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

    // 後処理フィルタリング：土地面積カテゴリに価格・金額が混入している場合はother_summaryに移動
    const filteredHighlights: string[] = [];
    for (const item of highlights) {
      if (item.startsWith('土地面積') && /万円|価格|査定|予想|円|~|〜/.test(item)) {
        // 土地面積カテゴリなのに金額情報が含まれている → その他に移動
        otherSummary = [item.replace(/^土地面積[：:]?\s*/, ''), ...otherSummary];
      } else {
        filteredHighlights.push(item);
      }
    }

    return res.json({ highlights: filteredHighlights, other_summary: otherSummary });
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
 * デバッグ用：スプレッドシートから過去報告書の取得状況を確認
 * GET /api/summarize/debug-report-bodies?templateName=xxx
 */
router.get('/debug-report-bodies', authenticate, async (req: Request, res: Response) => {
  try {
    const templateName = String(req.query.templateName || '').trim();
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';

    const client = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'テンプレート',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();
    const sheetsInstance = (client as any).sheets;

    // シート一覧
    const spreadsheetMeta = await sheetsInstance.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const allSheets = (spreadsheetMeta.data.sheets || []).map((s: any) => ({
      gid: s.properties?.sheetId,
      name: s.properties?.title,
    }));

    // gid=13393607のシートを探す
    const TARGET_GID = 13393607;
    const targetSheet = allSheets.find((s: any) => s.gid === TARGET_GID);
    const targetSheetName = targetSheet?.name || null;

    if (!targetSheetName) {
      return res.json({ allSheets, targetSheetName: null, error: 'gid=13393607のシートが見つかりません' });
    }

    // ヘッダー取得
    const headerResponse = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheetName}'!A1:ZZ1`,
    });
    const headers: string[] = (headerResponse.data.values?.[0] || []).map((h: any) => String(h || '').trim());

    const categoryColIdx = headers.findIndex((h: string) => h === '区分');
    const typeColIdx = headers.findIndex((h: string) => h === '種別');
    const bodyColIdx = headers.findIndex((h: string) => h === '物件本文');
    const effectiveCategoryIdx = categoryColIdx >= 0 ? categoryColIdx : 6;
    const effectiveTypeIdx = typeColIdx >= 0 ? typeColIdx : 9;
    const effectiveBodyIdx = bodyColIdx >= 0 ? bodyColIdx : 20;

    // 全データ取得（上限なし）
    const dataResponse = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheetName}'!A2:ZZ`,
    });
    const rows: any[][] = dataResponse.data.values || [];

    // 全行の区分・種別を集計
    const typeCounts: Record<string, number> = {};
    const matchedBodies: string[] = [];
    for (const row of rows) {
      const category = String(row[effectiveCategoryIdx] || '').trim();
      const type = String(row[effectiveTypeIdx] || '').trim();
      const body = String(row[effectiveBodyIdx] || '').trim();
      const key = `${category}|${type}`;
      typeCounts[key] = (typeCounts[key] || 0) + 1;
      if (templateName && category === '物件' && type === templateName && body.length > 0) {
        matchedBodies.push(body.substring(0, 50) + '...');
      }
    }

    return res.json({
      targetSheetName,
      totalRows: rows.length,
      headers: { categoryColIdx: effectiveCategoryIdx, typeColIdx: effectiveTypeIdx, bodyColIdx: effectiveBodyIdx },
      headerNames: { category: headers[effectiveCategoryIdx], type: headers[effectiveTypeIdx], body: headers[effectiveBodyIdx] },
      typeCounts,
      matchedCount: matchedBodies.length,
      matchedSamples: matchedBodies.slice(0, 5),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * スプレッドシートから同じ種別（テンプレ名）の過去報告書本文を取得する
 * J列=種別、G列=区分（「物件」）、U列=物件本文
 */
async function fetchPastReportBodiesFromSheet(templateName: string): Promise<string[]> {
  try {
    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TEMPLATE_SPREADSHEET_ID || '1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE';

    // まずスプレッドシートのシート一覧を取得してシート名を特定する
    const client = new GoogleSheetsClient({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'テンプレート', // 認証用（シート名は後で動的取得）
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    });
    await client.authenticate();

    const sheetsInstance = (client as any).sheets;

    // スプレッドシートのシート一覧を取得
    const spreadsheetMeta = await sheetsInstance.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheets = spreadsheetMeta.data.sheets || [];

    // gid=13393607 に対応するシートを探す
    const TARGET_GID = 13393607;
    let targetSheetName: string | null = null;
    for (const sheet of sheets) {
      if (sheet.properties?.sheetId === TARGET_GID) {
        targetSheetName = sheet.properties?.title || null;
        break;
      }
    }

    if (!targetSheetName) {
      // gidで見つからない場合は「送信履歴」「メール履歴」などの名前で探す
      const candidateNames = ['送信履歴', 'メール送信履歴', 'メール履歴', '履歴'];
      for (const name of candidateNames) {
        if (sheets.some((s: any) => s.properties?.title === name)) {
          targetSheetName = name;
          break;
        }
      }
    }

    if (!targetSheetName) {
      console.warn('[fetchPastReportBodies] 送信履歴シートが見つかりませんでした');
      return [];
    }

    console.log(`[fetchPastReportBodies] シート名: ${targetSheetName}, テンプレ名: ${templateName}`);

    // ヘッダー行を取得してG列・J列・U列のインデックスを特定
    const headerResponse = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheetName}'!A1:ZZ1`,
    });
    const headers: string[] = (headerResponse.data.values?.[0] || []).map((h: any) => String(h || '').trim());

    // カラム名で検索（G列=区分、J列=種別、U列=物件本文）
    const categoryColIdx = headers.findIndex(h => h === '区分');
    const typeColIdx = headers.findIndex(h => h === '種別');
    const bodyColIdx = headers.findIndex(h => h === '物件本文');

    // ヘッダーで見つからない場合は列番号で直接指定（G=6, J=9, U=20、0-indexed）
    const effectiveCategoryIdx = categoryColIdx >= 0 ? categoryColIdx : 6;
    const effectiveTypeIdx = typeColIdx >= 0 ? typeColIdx : 9;
    const effectiveBodyIdx = bodyColIdx >= 0 ? bodyColIdx : 20;

    console.log(`[fetchPastReportBodies] 列インデックス: 区分=${effectiveCategoryIdx}, 種別=${effectiveTypeIdx}, 物件本文=${effectiveBodyIdx}`);

    // データを取得（上限なし）
    const dataResponse = await sheetsInstance.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${targetSheetName}'!A2:ZZ`,
    });
    const rows: any[][] = dataResponse.data.values || [];

    // G列=「物件」かつ J列が templateName を含む行の U列を収集
    const pastBodies: string[] = [];
    for (const row of rows) {
      const category = String(row[effectiveCategoryIdx] || '').trim();
      const type = String(row[effectiveTypeIdx] || '').trim();
      const body = String(row[effectiveBodyIdx] || '').trim();

      if (category === '物件' && type === templateName && body.length > 0) {
        pastBodies.push(body);
      }
    }

    console.log(`[fetchPastReportBodies] 該当する過去報告書: ${pastBodies.length}件`);
    // 最新20件を返す（多すぎるとトークンを消費するため）
    return pastBodies.slice(-20);
  } catch (error: any) {
    console.error('[fetchPastReportBodies] エラー:', error.message);
    return [];
  }
}

/**
 * メール本文をAIで改善・バリエーション生成（Claude使用）
 * POST /api/summarize/enhance-email
 * Body: { currentBody: string, previousBodies: string[], mode: string, templateName?: string }
 */
router.post('/enhance-email', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentBody, previousBodies, mode, templateName } = req.body;
    const enhanceMode: 'light' | 'rewrite' = mode === 'rewrite' ? 'rewrite' : 'light';

    if (!currentBody || typeof currentBody !== 'string' || currentBody.trim().length === 0) {
      return res.status(400).json({ error: 'currentBody は必須です' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error('[enhance-email] ANTHROPIC_API_KEY not set');
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // スプレッドシートから同じ種別の過去報告書本文を取得
    let sheetPastBodies: string[] = [];
    if (templateName && typeof templateName === 'string' && templateName.trim().length > 0) {
      sheetPastBodies = await fetchPastReportBodiesFromSheet(templateName.trim());
    }

    // 参考例セクションを構築（スプレッドシート履歴 + 直近の送信履歴）
    const sheetHistorySection = sheetPastBodies.length > 0
      ? `【過去に当社が実際に送った「${templateName}」の報告書本文（${sheetPastBodies.length}件）】\n` +
        `※ これらは実際に送った文章です。このトーン・文体・文章量を参考にしてください。\n\n` +
        sheetPastBodies.map((b, i) => `--- 参考例${i + 1} ---\n${b}`).join('\n\n')
      : '';

    const recentHistorySection = Array.isArray(previousBodies) && previousBodies.length > 0
      ? `【この物件に最近送った本文（直近${previousBodies.length}件）】\n` +
        `※ これらと同じ表現・言い回しにならないよう変えてください。\n\n` +
        previousBodies.map((b, i) => `--- 直近${i + 1}回目 ---\n${b}`).join('\n\n')
      : '';

    const referenceSection = [sheetHistorySection, recentHistorySection].filter(Boolean).join('\n\n---\n\n');

    const systemPrompt = enhanceMode === 'rewrite'
      ? `あなたは不動産会社の担当者です。売主への報告メールを書き直してください。

【最重要：参考例のトーン・文体・文章量に合わせること】
過去に実際に送った報告書の参考例が提供されている場合、その文章のトーン・文体・文章量を忠実に再現してください。
参考例が「短くシンプル」なら短くシンプルに、「丁寧で詳しい」なら丁寧で詳しく書いてください。
参考例がない場合は、ビジネスメールとして自然な文体で書いてください。

【絶対に守るルール】
- 参考例の文章量・トーンから大きく外れない（大げさな表現・過剰な敬語・不自然な膨らませ方は禁止）
- 元の本文の情報・事実・趣旨は完全に同じにする
- 元の文章の単語・フレーズを極力使わない（別の言葉に置き換える）
- 冒頭の挨拶はビジネスメールとして適切な範囲で変える
- 署名部分（「---」以降や名前・会社名・電話番号など）は一切変更しない
- 書き直した本文のみを返す（説明・コメント・前置き不要）`
      : `あなたは不動産会社の担当者です。売主への報告メールの本文を改善してください。

【最重要：参考例のトーン・文体に合わせること】
過去に実際に送った報告書の参考例が提供されている場合、そのトーン・文体を参考にしてください。
参考例がない場合は、ビジネスメールとして自然な文体で書いてください。

【ルール】
- 元の本文の意味・内容・構成は変えない
- 直近に送った本文と同じ表現・言い回しにならないよう、ニュアンスや言葉を変える
- 文章の長さは元の本文と同程度にする（大げさに膨らませない）
- 署名部分（「---」以降や名前・会社名など）は変更しない
- 改行・段落構成は元の本文に合わせる
- 改善した本文のみを返す（説明文・コメント不要）`;

    const userMessage = enhanceMode === 'rewrite'
      ? `${referenceSection ? referenceSection + '\n\n---\n\n' : ''}【今回の本文（書き直してください）】\n${currentBody}`
      : `${referenceSection ? referenceSection + '\n\n---\n\n' : ''}【今回の本文（改善してください）】\n${currentBody}`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-5',
        max_tokens: enhanceMode === 'rewrite' ? 2000 : 1500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
        ],
      },
      {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const enhancedBody = response.data?.content?.[0]?.text?.trim() || '';
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
      return res.status(401).json({ error: 'Anthropic APIキーが無効です。' });
    }
    return res.status(500).json({ error: 'メール改善に失敗しました' });
  }
});

/**
 * コメントからハウスメーカー名を抽出し、A4用メリット情報を生成
 * POST /summarize/house-maker-info
 * body: { commentText: string }
 * response: { makerName: string, content: string }
 */
router.post('/house-maker-info', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentText } = req.body;

    if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
      return res.status(400).json({ error: 'commentText は必須です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[house-maker-info] OPENAI_API_KEY not set');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const plainText = commentText.replace(/<[^>]+>/g, '').trim();

    // Step1: コメントからハウスメーカー名を抽出
    const extractCompletion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `コメントからハウスメーカー名を1つだけ抽出してください。
ハウスメーカー名のみをJSON形式で返してください。
例: {"makerName": "一条工務店"}
ハウスメーカーが見つからない場合: {"makerName": null}`,
          },
          {
            role: 'user',
            content: `以下のコメントからハウスメーカー名を抽出してください：\n\n${plainText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const extractRaw = extractCompletion.data?.choices?.[0]?.message?.content || '{}';
    let makerName: string | null = null;
    try {
      const parsed = JSON.parse(extractRaw);
      makerName = parsed.makerName || null;
    } catch (e) {
      console.error('[house-maker-info] extract parse error:', e);
    }

    if (!makerName) {
      return res.status(404).json({ error: 'ハウスメーカーが見つかりませんでした' });
    }

    // Step2: ハウスメーカーのA4用メリット情報を生成
    const contentCompletion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `あなたは住宅業界に精通した不動産のプロフェッショナルです。
売主のお客様に「この担当者は自分の家のことをよく知っている！」と驚いてもらえるよう、
そのハウスメーカーならではの具体的な特徴・技術・仕様をA4一枚にまとめた資料を作成してください。

【絶対に守るルール】
- 「高い耐震性」「優れた断熱性」「自由設計」など、どのメーカーにも当てはまる抽象的・一般的な表現は使わない
- 必ずそのメーカー固有の技術名・工法名・製品名・数値を使う
- 専門用語や固有名詞（例：「シーカス構法」「i-smart」「GJ工法」など）を使う場合は、必ず括弧内に一言説明を入れる
  例：「シーカス構法（制震ダンパーで地震エネルギーを熱に変換する独自技術）」
  例：「i-smart（一条工務店の高断熱・高気密住宅シリーズ）」
- 数値・スペックがある場合は積極的に記載する
  例：「UA値0.25以下（業界最高水準の断熱性能）」「耐震等級3（最高等級）標準取得」
- 「〜が特徴です」「〜に優れています」で終わる文は禁止。具体的な内容で締める

【出力形式】
以下のJSON形式で返してください：
{
  "makerName": "ハウスメーカー名",
  "tagline": "そのメーカーを一言で表す具体的なキャッチコピー（20文字以内）",
  "sections": [
    {
      "title": "セクションタイトル",
      "points": ["ポイント1", "ポイント2", "ポイント3"]
    }
  ],
  "summary": "売主への共感メッセージ（50文字以内、そのメーカーの家に住んでいることへの誇りを引き出す一文）"
}

【セクション構成（必ず以下の5つ）】
1. 構造・耐震性（固有の工法名・構造名・耐震等級・実績数値を必ず含める）
2. 断熱・省エネ性能（UA値・C値・断熱材の種類・窓の仕様など具体的スペックを含める）
3. このメーカーならではの強み（他社にない独自技術・設備・こだわりを3〜4点）
4. 品質・保証・アフターサービス（保証年数・点検頻度・具体的なサービス内容）
5. 資産価値・売却時のポイント（中古市場での評価・買主へのアピールポイント・価格維持率など）

【各ポイントの書き方】
- 1項目40〜70文字程度
- 固有名詞・技術名には必ず括弧で説明を付ける
- 数値があれば必ず入れる
- 「〜できます」より「〜を実現」「〜を標準装備」「〜を採用」などの具体的な表現を使う`,
          },
          {
            role: 'user',
            content: `${makerName}のメリット・特徴をA4資料用にまとめてください。`,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const contentRaw = contentCompletion.data?.choices?.[0]?.message?.content || '{}';
    let content: any = null;
    try {
      content = JSON.parse(contentRaw);
    } catch (e) {
      console.error('[house-maker-info] content parse error:', e);
      return res.status(500).json({ error: 'コンテンツの生成に失敗しました' });
    }

    return res.json({ makerName, content });
  } catch (error: any) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data?.error?.message || error.message;
    console.error(`[house-maker-info] Error (HTTP ${status}):`, errMsg);

    if (status === 429) {
      return res.status(429).json({ error: 'APIの利用制限に達しました。しばらく待ってから再試行してください。' });
    }
    if (status === 401) {
      return res.status(401).json({ error: 'OpenAI APIキーが無効です。' });
    }
    return res.status(500).json({ error: 'ハウスメーカー情報の生成に失敗しました' });
  }
});

/**
 * 通話内容を文字起こし（Whisper API）
 * POST /api/summarize/transcribe
 * Body: multipart/form-data { audio: File }
 * Response: { transcript: string }
 */
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

router.post('/transcribe', authenticate, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '音声ファイルが必要です' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Node.js v18+ ビルトインの FormData + Blob を利用
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || 'audio/webm',
    });
    formData.append('file', blob, req.file.originalname || 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const transcript: string = response.data?.text || '';
    return res.json({ transcript });
  } catch (error: any) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data?.error?.message || error.message;
    console.error(`[transcribe] Error (HTTP ${status}):`, errMsg);
    if (status === 429) {
      return res.status(429).json({ error: 'APIの利用制限に達しました。しばらく待ってから再試行してください。' });
    }
    return res.status(500).json({ error: `文字起こしに失敗しました: ${errMsg}` });
  }
});

/**
 * 文字起こしテキストを要約・議事録作成
 * POST /api/summarize/summarize-transcript
 * Body: { transcript: string, sellerName?: string, summaryType?: 'call' | 'meeting' }
 * Response: { summary: string }
 *
 * summaryType='call'  → GPT-4o-mini（通話メモ用・短文）
 * summaryType='meeting' → Claude claude-sonnet-4-5（議事録用・2時間超対応）
 */
router.post('/summarize-transcript', authenticate, async (req: Request, res: Response) => {
  try {
    const { transcript, sellerName, summaryType } = req.body;
    const type: 'call' | 'meeting' = summaryType === 'meeting' ? 'meeting' : 'call';

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'transcript は必須です' });
    }

    // ── 議事録モード：Claude claude-sonnet-4-5（200kトークン対応） ──────────────────
    if (type === 'meeting') {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
      }

      const systemPrompt = `あなたは会議・打ち合わせの議事録作成アシスタントです。
会議の文字起こしを読んで、以下の形式で議事録を作成してください。

【議事録の構成】
## 1. 会議の目的・概要
（1〜2文で簡潔に）

## 2. 決定事項
- （箇条書き。「決定した」「〜にすることになった」内容を全て列挙）

## 3. 主な議論・検討事項
- （箇条書き。議論になったが結論が出ていない内容・重要な意見）

## 4. 次のアクション・TODO
- 【担当者】内容（期限があれば記載）

## 5. その他・特記事項
- （共有情報・注意事項など）

【出力ルール】
- 決定事項とTODOを特に明確・具体的に書く
- 誰が何を言ったかより「何が決まったか・何をすべきか」を優先する
- 文字起こしが長い場合でも全体を漏れなく確認し、重要事項を全て拾う
- 冗長な繰り返しはまとめる
- 日本語で出力する`;

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-5',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `以下の会議の文字起こしから議事録を作成してください：\n\n${transcript}`,
            },
          ],
        },
        {
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2時間分のテキスト処理に余裕を持たせる
        }
      );

      const summary: string =
        response.data?.content?.[0]?.text?.trim() || '';
      return res.json({ summary });
    }

    // ── 通話メモモード：GPT-4o-mini（短文・低コスト） ───────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const callSystemPrompt = `あなたは不動産会社の営業担当者のアシスタントです。
売主${sellerName ? `（${sellerName}様）` : ''}との電話通話の文字起こしを読んで、以下の点を簡潔に要約してください。

【要約のポイント】
- 通話の主な目的・内容
- 売主の反応・感触（売却意欲・懸念点など）
- 重要な情報（査定希望・ローン・名義・売却理由など）
- 次のアクション（再連絡の約束・資料送付など）

【出力ルール】
- 500文字以内で簡潔にまとめる
- 箇条書きを活用して読みやすく
- 担当者が次の通話前に確認するメモとして役立つ内容にする`;

    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: callSystemPrompt },
          { role: 'user', content: `以下の通話内容を要約してください：\n\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const summary: string = completion.data?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({ summary });

  } catch (error: any) {
    const status = error?.response?.status;
    const errMsg = error?.response?.data?.error?.message || error.message;
    console.error(`[summarize-transcript] Error (HTTP ${status}):`, errMsg);
    if (status === 429) {
      return res.status(429).json({ error: 'APIの利用制限に達しました。しばらく待ってから再試行してください。' });
    }
    return res.status(500).json({ error: `要約に失敗しました: ${errMsg}` });
  }
});

export default router;

