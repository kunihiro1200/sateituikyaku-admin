import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

// Supabaseクライアント
const getSupabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// スプレッドシートIDを抽出するユーティリティ
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * GET /api/mansion-jyucho/debug-cells
 * 現在のセルマッピングを返す（デバッグ用）
 */
router.get('/debug-cells', (_req: Request, res: Response) => {
  const cells = JYUCHO_ITEMS.filter((i) => i.cell).map((i) => ({ key: i.key, label: i.label, cell: i.cell }));
  return res.json({ success: true, cells });
});

// 重調（重要事項説明書）の抽出項目定義
// 重説シートのセルマッピング付き
//
// ─── (6) 計画修繕積立金等に関する事項 ───────────────────────────────
//   T443  : 計画修繕積立金制度「無」チェック          (boolean)
//   Z443  : 計画修繕積立金制度「有—別添規約等参照」チェック (boolean)
//   W445  : 当該住戸の計画修繕積立金 月額（金額）
//   AI445 : 当該住戸の計画修繕積立金 滞納額
//   AU445 : 当該住戸の計画修繕積立金 滞納額 年
//   AY445 : 当該住戸の計画修繕積立金 滞納額 月
//   BC445 : 当該住戸の計画修繕積立金 滞納額 日
//   W448  : 管理組合積立総額（金額）
//   AI448 : 管理組合積立総額 滞納額
//   AU448 : 管理組合積立総額 滞納額 年
//   AY448 : 管理組合積立総額 滞納額 月
//   BC448 : 管理組合積立総額 滞納額 日
//   T450  : 預金名義人「管理組合」チェック            (boolean)
//   AB450 : 預金名義人「その他」チェック              (boolean)
//   AE450 : 預金名義人「その他」入力欄
//   F451  : 備考欄
// ─── (7) 通常の管理費用の額 ─────────────────────────────────────────
//   J457  : 通常の管理費 月額（金額）
//   Z457  : 通常の管理費 年
//   AD457 : 通常の管理費 月
//   AH457 : 通常の管理費 日
//   Q460  : 当該住戸の滞納額
//   AK460 : 当該管理組合の滞納額
//   AW460 : 当該管理組合の滞納額 年
//   BA460 : 当該管理組合の滞納額 月
//   BE460 : 当該管理組合の滞納額 日
//   G462  : 備考（その他・請求時期など）
// ─── (8) 管理の委託先 ────────────────────────────────────────────────
//   L467  : 管理の形態（プルダウン: "委託管理(全部)" / "委託管理(一部)" / "自主管理"）
//   AG467 : 管理組合の名称
//   W468  : 管理会社名・住所（氏名（商号又は名称）＋住所）
//   AZ468 : 管理会社TEL
//   AH469 : 登録回数
//   AR469 : 登録番号
// ─── (9) 管理業者管理者方式か否か ───────────────────────────────────
//   T474  : 「該当する」チェック                      (boolean)
//   AF474 : 「該当しない」チェック                    (boolean)
// ─── (10) 建物の維持修繕の実施状況の記録 ────────────────────────────
//   L478  : 共用部分「有」チェック                    (boolean)
//   L479  : 共用部分「無」チェック                    (boolean)
//   P478  : 共用部分修繕履歴入力欄
//   L480  : 専有部分「有」チェック                    (boolean)
//   L481  : 専有部分「無」チェック                    (boolean)
//   P480  : 専有部分修繕履歴入力欄
//
// ─── 日付セル（令和年・月・日）────────────────────────────────────────
//   (6) 当該住戸の計画修繕積立金 滞納額の日付
//     AU445(年) AY445(月) BC445(日)
//   (6) 管理組合積立総額 滞納額の日付
//     AU448(年) AY448(月) BC448(日)
//   (7) 通常の管理費 現在日付
//     Z457(年) AD457(月) AH457(日)
//   (7) 当該管理組合の滞納額の日付
//     AW460(年) BA460(月) BE460(日)

// 西暦→令和変換（令和元年=2019年）
function seirekiToReiwa(year: number): number {
  return year - 2018; // 2019→1, 2026→8
}

// PDFから抽出した西暦年月日を令和に変換して日付セルグループに書き込む
// dateStr: "2026年04月" or "2026年04月30日" 形式
function parseDateToReiwa(dateStr: string | null): { year: string | null; month: string | null; day: string | null } {
  if (!dateStr) return { year: null, month: null, day: null };
  const m = dateStr.match(/(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/);
  if (!m) return { year: null, month: null, day: null };
  const reiwaYear = seirekiToReiwa(parseInt(m[1], 10));
  return {
    year: String(reiwaYear),
    month: String(parseInt(m[2], 10)),
    day: m[3] ? String(parseInt(m[3], 10)) : null,
  };
}

const JYUCHO_ITEMS = [
  // ── (6) 計画修繕積立金等に関する事項 ──
  { key: 'repair_fund_none',              label: '計画修繕積立金制度「無」',                                        cell: 'T443',  type: 'boolean' },
  { key: 'repair_fund_exists',            label: '計画修繕積立金制度「有—別添規約等参照」',                          cell: 'Z443',  type: 'boolean' },
  { key: 'repair_monthly_amount',         label: '当該住戸の計画修繕積立金 月額（その住戸1戸分の月額。数字のみ、カンマ・円不要）',                cell: 'W445',  type: 'text' },
  { key: 'repair_monthly_arrears',        label: '当該住戸の計画修繕積立金 滞納額（その住戸1戸分の滞納額。数字のみ、カンマ・円不要）',              cell: 'AI445', type: 'text' },
  { key: 'repair_monthly_date',           label: '当該住戸の計画修繕積立金 基準日（西暦 例:"2026年04月30日"）',     cell: null,    type: 'date',
    dateCells: { year: 'AU445', month: 'AY445', day: 'BC445' } },
  { key: 'repair_total_amount',           label: '当該管理組合に既に積み立てられている計画修繕積立金等の総額（「積立金会計繰越額」または「積立金残高」の金額。数字のみ、カンマ・円不要）', cell: 'W448',  type: 'text' },
  { key: 'repair_total_arrears',          label: '管理組合 積立総額の滞納額（管理組合全体の修繕積立金滞納合計。数字のみ、カンマ・円不要）',        cell: 'AI448', type: 'text' },
  { key: 'repair_total_date',             label: '管理組合 積立総額 基準日（西暦 例:"2026年04月30日"）',            cell: null,    type: 'date',
    dateCells: { year: 'AU448', month: 'AY448', day: 'BC448' } },
  { key: 'deposit_holder_kumiai',         label: '預金名義人「管理組合」',                                          cell: 'T450',  type: 'boolean' },
  { key: 'deposit_holder_other_check',    label: '預金名義人「その他」チェック',                                    cell: 'AB450', type: 'boolean' },
  { key: 'deposit_holder_other_text',     label: '預金名義人「その他」入力欄',                                      cell: 'AE450', type: 'text' },
  { key: 'repair_fund_note',              label: '(6) 備考',                                                        cell: 'F451',  type: 'text' },
  // ── (7) 通常の管理費用の額 ──
  { key: 'management_fee_amount',         label: '通常の管理費 月額',                                               cell: 'J457',  type: 'text' },
  { key: 'management_fee_date',           label: '通常の管理費 基準日（西暦 例:"2026年04月"）',                     cell: null,    type: 'date',
    dateCells: { year: 'Z457', month: 'AD457', day: 'AH457' } },
  { key: 'management_fee_arrears_unit',   label: '当該住戸の滞納額',                                               cell: 'Q460',  type: 'text' },
  { key: 'management_fee_arrears_kumiai', label: '当該管理組合の滞納額',                                           cell: 'AK460', type: 'text' },
  { key: 'management_fee_arrears_date',   label: '当該管理組合の滞納額 基準日（西暦 例:"2026年04月30日"）',         cell: null,    type: 'date',
    dateCells: { year: 'AW460', month: 'BA460', day: 'BE460' } },
  { key: 'management_fee_note',           label: '(7) 備考（その他・請求時期など）',             cell: 'G462',  type: 'text' },
  // ── (8) 管理の委託先 ──
  // management_form は "委託管理(全部)" / "委託管理(一部)" / "自主管理" の3択
  { key: 'management_form',               label: '管理の形態（委託管理(全部)/委託管理(一部)/自主管理 のいずれか）', cell: 'L467',  type: 'text' },
  { key: 'management_kumiai_name',        label: '管理組合の名称',                              cell: 'AG467', type: 'text' },
  { key: 'management_company_name',       label: '管理会社名（氏名・商号）と住所（改行区切り）', cell: 'W468',  type: 'text' },
  { key: 'management_company_tel',        label: '管理会社TEL',                                 cell: 'AZ468', type: 'text' },
  { key: 'management_reg_count',          label: '管理業者登録回数（数字のみ）',                cell: 'AH469', type: 'text' },
  { key: 'management_reg_no',             label: '管理業者登録番号（数字のみ）',                cell: 'AR469', type: 'text' },
  // ── (9) 管理業者管理者方式か否か ──
  { key: 'mgmt_agent_applicable',         label: '管理業者管理者方式「該当する」',              cell: 'T474',  type: 'boolean' },
  { key: 'mgmt_agent_not_applicable',     label: '管理業者管理者方式「該当しない」',            cell: 'AF474', type: 'boolean' },
  // ── (10) 建物の維持修繕の実施状況の記録 ──
  { key: 'common_area_repair_exists',     label: '共用部分修繕「有」',                          cell: 'L478',  type: 'boolean' },
  { key: 'common_area_repair_none',       label: '共用部分修繕「無」',                          cell: 'L479',  type: 'boolean' },
  { key: 'common_area_repair_history',    label: '共用部分修繕履歴',                            cell: 'P478',  type: 'text' },
  { key: 'exclusive_area_repair_exists',  label: '専有部分修繕「有」',                          cell: 'L480',  type: 'boolean' },
  { key: 'exclusive_area_repair_none',    label: '専有部分修繕「無」',                          cell: 'L481',  type: 'boolean' },
  { key: 'exclusive_area_repair_history', label: '専有部分修繕履歴',                            cell: 'P480',  type: 'text' },
  // ── 管理規約関連（参考情報・書き込みなし）──
  { key: 'usage_restriction',             label: '用途制限',                                    cell: null,    type: 'text' },
  { key: 'pets',                          label: 'ペットの飼育',                                cell: null,    type: 'text' },
  { key: 'piano',                         label: 'ピアノ・楽器の使用',                          cell: null,    type: 'text' },
  { key: 'flooring',                      label: 'フローリング張替え工事',                      cell: null,    type: 'text' },
  { key: 'renovation',                    label: 'リフォーム・改修工事全般',                    cell: null,    type: 'text' },
  { key: 'balcony_exclusive',             label: '専用使用権 - バルコニー',                     cell: null,    type: 'text' },
  { key: 'parking_exclusive',             label: '専用使用権 - 専用駐車場',                     cell: null,    type: 'text' },
  { key: 'bicycle_exclusive',             label: '専用使用権 - 専用駐輪場',                     cell: null,    type: 'text' },
  { key: 'garden_exclusive',              label: '専用使用権 - 専用庭',                         cell: null,    type: 'text' },
  { key: 'storage_exclusive',             label: '専用使用権 - 専用倉庫',                       cell: null,    type: 'text' },
  { key: 'sublease',                      label: '民泊・短期賃貸（Airbnb等）',                  cell: null,    type: 'text' },
  { key: 'parking',                       label: '駐車場・駐輪場の利用',                        cell: null,    type: 'text' },
  { key: 'noise',                         label: '騒音・生活音の制限',                          cell: null,    type: 'text' },
  { key: 'garbage',                       label: 'ゴミ出しルール',                              cell: null,    type: 'text' },
  { key: 'subletting',                    label: '専有部分の第三者への貸与',                    cell: null,    type: 'text' },
];

/**
 * POST /api/mansion-jyucho/analyze
 * マンション重要事項説明書（重調）のPDF/画像を解析して項目ごとの内容を抽出
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

    const itemsDetail = JYUCHO_ITEMS.map((item) => `- "${item.key}": ${item.label}`).join('\n');

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

    const keyList = JYUCHO_ITEMS.map((i) => `"${i.key}": null`).join(', ');

    contentBlocks.push({
      type: 'text',
      text: `あなたはマンション重要事項説明書（重調）の専門家です。
添付された重要事項説明書の文書を読み取り、以下の各項目について該当する内容を抽出してください。

【抽出するkey一覧】
${itemsDetail}

【重要ルール】
1. 原文に近い形で記載すること
2. 数値項目（管理費、修繕積立金など）は数字のみを抽出すること（カンマ・円・単位は除く。例: "6,200円" → "6200"）
3. 管理会社名・住所・TELは正確に抽出すること
4. 「management_form」（管理の形態）は必ず以下の3択のいずれかを返すこと:
   - "委託管理(全部)"
   - "委託管理(一部)"
   - "自主管理"
   上記以外の表現が書かれていても、最も近い選択肢に変換すること
5. boolean型の項目（チェックボックス）は true または false で返すこと
   - チェックが入っている・「有」・「該当する」→ true
   - チェックなし・「無」・「該当しない」→ false
   - 記載がない場合は null
6. 管理会社の住所と名称が同じセルに入る場合（management_company_name）は「名称\n住所」の形式で返すこと
7. date型の項目（基準日）は「○○年○○月○○日」または「○○年○○月」の形式で西暦のまま返すこと
   - 例: "2026年04月30日" または "2026年04月"
   - 同じ書類内で複数の基準日がある場合は、その項目に対応する日付を返すこと
   - 通常は同じ日付が複数箇所に使われる（例: 「2026年04月現在」「2026年04月30日現在」）
8. 見つからない場合はnull
9. 必ず以下のJSON形式のみで応答すること（説明文・コードブロック記号は不要）

{${keyList}}`,
    });

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    console.log('[mansion-jyucho] Claude response (first 300):', responseText.substring(0, 300));

    let extractedData: Record<string, string | null> = {};

    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (jsonStr) {
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[mansion-jyucho] JSON parse error:', parseError);
        extractedData = {};
      }
    } else {
      console.warn('[mansion-jyucho] No JSON in response:', responseText.substring(0, 200));
      extractedData = {};
    }

    const results = JYUCHO_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      content: extractedData[item.key] ?? null,
      found: extractedData[item.key] != null,
      cell: item.cell,
    }));

    return res.json({ success: true, fileCount: files.length, results });
  } catch (error: any) {
    console.error('[mansion-jyucho] 解析エラー:', error?.message || error);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'APIのレート制限に達しました。しばらく待ってから再試行します。',
        },
      });
    }

    return res.status(500).json({ error: error?.message || '解析中にエラーが発生しました' });
  }
});

/**
 * POST /api/mansion-jyucho/write
 * 解析結果を重説シートの指定セルに書き込む
 * ※ フロントから送られる cell 値は無視し、常に最新の JYUCHO_ITEMS のセルマッピングを使用する
 */
router.post('/write', async (req: Request, res: Response) => {
  try {
    const { spreadsheetUrl, results } = req.body as {
      spreadsheetUrl: string;
      results: Array<{ key: string; label: string; content: string | null; cell?: string | null; type?: string }>;
    };

    if (!spreadsheetUrl || !results) {
      return res.status(400).json({ error: 'spreadsheetUrl と results は必須です' });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'スプレッドシートIDの抽出に失敗しました' });
    }

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: '重説',
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    // フロントから送られた results を key で JYUCHO_ITEMS と突合し、
    // 常に最新のセルマッピングを使って書き込む（古いキャッシュのセル値を無視）
    const itemMap = new Map(JYUCHO_ITEMS.map((i) => [i.key, i]));

    // 通常セルへの書き込みリスト
    const writableItems: Array<{ cell: string; content: string; type: string }> = [];
    // 日付セルへの書き込みリスト（令和年・月・日に分割済み）
    const dateWrites: Array<{ cell: string; value: string }> = [];

    for (const r of results) {
      const master = itemMap.get(r.key) as any;
      if (!master) continue;
      if (r.content === null || r.content === undefined || r.content === '') continue;

      if (master.type === 'date' && master.dateCells) {
        // 日付型: 西暦→令和変換して年・月・日セルに分割書き込み
        const parsed = parseDateToReiwa(r.content);
        const dc = master.dateCells as { year: string; month: string; day: string };
        if (parsed.year) dateWrites.push({ cell: dc.year, value: parsed.year });
        if (parsed.month) dateWrites.push({ cell: dc.month, value: parsed.month });
        if (parsed.day) dateWrites.push({ cell: dc.day, value: parsed.day });
      } else if (master.cell) {
        writableItems.push({ cell: master.cell, content: r.content, type: master.type });
      }
    }

    console.log(`[mansion-jyucho] 通常セル: ${writableItems.length}件, 日付セル: ${dateWrites.length}件`);

    for (const item of writableItems) {
      let writeValue: string;
      if (item.type === 'boolean') {
        const boolVal = item.content === 'true' || item.content === true as any;
        writeValue = boolVal ? 'TRUE' : 'FALSE';
      } else {
        writeValue = item.content;
      }
      await sheetsClient.writeRawCell(item.cell, writeValue);
      console.log(`[mansion-jyucho] 書き込み完了: ${item.cell} = ${writeValue}`);
    }

    for (const dw of dateWrites) {
      await sheetsClient.writeRawCell(dw.cell, dw.value);
      console.log(`[mansion-jyucho] 日付書き込み完了: ${dw.cell} = ${dw.value}`);
    }

    const totalWritten = writableItems.length + dateWrites.length;

    return res.json({
      success: true,
      message: `重説シートへの書き込みが完了しました（${totalWritten}セル）`,
      writtenCount: totalWritten,
    });
  } catch (error: any) {
    console.error('[mansion-jyucho] 書き込みエラー:', error?.message || error);
    return res.status(500).json({ error: error?.message || '書き込み中にエラーが発生しました' });
  }
});

/**
 * POST /api/mansion-jyucho/save
 * 解析結果をDBに保存（物件番号ごとにupsert）
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { propertyNumber, results } = req.body as {
      propertyNumber: string;
      results: any[];
    };

    if (!propertyNumber || !results) {
      return res.status(400).json({ error: 'propertyNumber と results は必須です' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('mansion_jyucho_results')
      .upsert(
        {
          property_number: propertyNumber,
          results,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: 'property_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('[mansion-jyucho/save] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[mansion-jyucho/save] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mansion-jyucho/:propertyNumber
 * 物件番号で保存済み解析結果を取得
 */
router.get('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('mansion_jyucho_results')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data: data || null });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mansion-jyucho/debug-cells
 * 現在のセルマッピングを返す（デバッグ用）
 */
router.get('/debug-cells', (_req: Request, res: Response) => {
  const cells = JYUCHO_ITEMS.filter((i) => i.cell).map((i) => ({ key: i.key, label: i.label, cell: i.cell }));
  return res.json({ success: true, cells });
});

export default router;
