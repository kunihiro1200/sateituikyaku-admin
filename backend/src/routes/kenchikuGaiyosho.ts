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

// 建築概要書・重説資料等から抽出する項目定義
// セルマッピングは重説シートの対応セル番地
const GAIYOSHO_ITEMS = [
  // ── 都市計画区域 ──
  { key: 'city_plan_urbanized',        label: '市街化区域（「市街化区域」の記載があればTRUE）',                          cell: 'U39',   type: 'boolean' },
  { key: 'city_plan_adjust',           label: '市街化調整区域（「市街化調整区域」の記載があればTRUE）',                  cell: 'AE39',  type: 'boolean' },
  // ── 開発行為 ──
  { key: 'dev_act_planned',            label: '開発行為をする場合（開発行為の予定がある場合TRUE）',                       cell: 'S43',   type: 'boolean' },
  { key: 'dev_act_completed',          label: '開発行為完了の場合（開発行為が完了している場合TRUE）',                     cell: 'S45',   type: 'boolean' },
  { key: 'dev_act_notice_done',        label: '工事完了公告有（工事完了公告がある場合TRUE）',                             cell: 'X46',   type: 'boolean' },
  { key: 'dev_act_reg_no',             label: '開発行為完了の登録簿番号（登録簿番号のテキスト）',                         cell: 'AO46',  type: 'text'    },
  { key: 'dev_act_notice_none',        label: '工事完了公告無（工事完了公告がない場合TRUE）',                             cell: 'AX46',  type: 'boolean' },
  // ── 用途地域 ──
  { key: 'use_zone_1',                 label: '用途地域1つ目（例：第一種低層住居専用地域）',                              cell: 'Q60',   type: 'text'    },
  { key: 'use_zone_2',                 label: '用途地域2つ目（2つにまたがる場合のみ。なければnull）',                    cell: 'AK60',  type: 'text'    },
  // ── 地域地区 ──
  { key: 'special_use_district',       label: '特別用途地区（指定ありTRUE）',                                            cell: 'Q152',  type: 'boolean' },
  { key: 'special_use_district_name',  label: '特別用途地区の内容（地区名や内容テキスト）',                              cell: 'AB152', type: 'text'    },
  { key: 'specific_use_restrict',      label: '特定用途制限地域（指定ありTRUE）',                                        cell: 'Q153',  type: 'boolean' },
  { key: 'high_rise_residential',      label: '高層住居誘導地域（指定ありTRUE）',                                        cell: 'Q154',  type: 'boolean' },
  { key: 'height_district',            label: '高度地区（指定ありTRUE）',                                                cell: 'AD154', type: 'boolean' },
  { key: 'height_district_type',       label: '高度地区の種類（例：第一種高度地区）',                                    cell: 'AM154', type: 'text'    },
  { key: 'high_use_district',          label: '高度利用地区（指定ありTRUE）',                                            cell: 'AZ154', type: 'boolean' },
  { key: 'fire_zone',                  label: '防火地域（指定ありTRUE）',                                                cell: 'Q155',  type: 'boolean' },
  { key: 'semi_fire_zone',             label: '準防火地域（指定ありTRUE）',                                              cell: 'Y155',  type: 'boolean' },
  { key: 'disaster_prevention_block',  label: '特定防災街区整備地区（指定ありTRUE）',                                    cell: 'AH155', type: 'boolean' },
  { key: 'scenic_zone',                label: '風致地区（指定ありTRUE）',                                                cell: 'AV155', type: 'boolean' },
  // ── 建蔽率・容積率 ──
  { key: 'building_coverage_ratio',    label: '指定建蔽率（数字のみ。例：60%→60）',                                      cell: 'Z158',  type: 'text'    },
  { key: 'floor_area_ratio',           label: '指定容積率（数字のみ。例：200%→200）',                                    cell: 'AA167', type: 'text'    },
  // ── 道路関係 ──
  { key: 'road_width',                 label: '道路幅員（数字のみ、m除外。例：6m→6）',                                   cell: 'AD172', type: 'text'    },
  { key: 'special_road_relaxation',    label: '特定道路による緩和（数字のみ、m除外）',                                   cell: 'AK172', type: 'text'    },
  { key: 'road_width_coeff',           label: '道路幅員制限の計算係数（住居系→40、非住居系→60）',                        cell: 'AS172', type: 'text'    },
  { key: 'road_width_under_12m',       label: '前面道路幅員が12m未満（TRUE/FALSE）',                                     cell: 'Q174',  type: 'boolean' },
  { key: 'road_width_over_12m',        label: '前面道路幅員が12m以上（TRUE/FALSE）',                                     cell: 'Q175',  type: 'boolean' },
  // ── 建築制限 ──
  { key: 'min_site_area',              label: '最低敷地面積（数字のみ、㎡除外）',                                         cell: 'AF185', type: 'text'    },
  // ── 条例・区域（すべてBoolean） ──
  { key: 'disaster_danger_zone',       label: '災害危険区域（指定ありTRUE）',                                            cell: 'P187',  type: 'boolean' },
  { key: 'district_plan_zone',         label: '地区計画の区域（指定ありTRUE）',                                          cell: 'Z187',  type: 'boolean' },
  { key: 'building_agreement_zone',    label: '建築協定区域（指定ありTRUE）',                                            cell: 'AK187', type: 'boolean' },
  { key: 'scenic_zone_ordinance',      label: '風致地区（条例・区域欄、指定ありTRUE）',                                  cell: 'AU187', type: 'boolean' },
  { key: 'beppu_landscape_ordinance',  label: '別府市景観条例（適用ありTRUE）',                                          cell: 'P188',  type: 'boolean' },
  { key: 'beppu_env_ordinance',        label: '別府市環境保全条例（適用ありTRUE）',                                      cell: 'AB188', type: 'boolean' },
  // ── 接道（最大3行） ──
  { key: 'road_facing_direction_1',      label: '接道方向1行目（例：南、東南。方位のみ）',                            cell: 'S201',  type: 'text'    },
  { key: 'road_public_private_1',        label: '公・私道の別1行目（「公道」または「私道」）',                        cell: 'AB201', type: 'text'    },
  { key: 'road_type_1',                  label: '接面道路の種類1行目（ア〜キから選択）',                              cell: 'AK201', type: 'text'    },
  { key: 'road_width_contact_1',         label: '幅員1行目（数字のみ、m除外）',                                       cell: 'AV201', type: 'text'    },
  { key: 'road_contact_length_1',        label: '接道長さ1行目（数字のみ、m除外）',                                   cell: 'BD201', type: 'text'    },
  { key: 'road_facing_direction_2',      label: '接道方向2行目（例：東、北西。方位のみ。2本目の道路がある場合のみ）', cell: 'S202',  type: 'text'    },
  { key: 'road_public_private_2',        label: '公・私道の別2行目（2本目がある場合のみ）',                          cell: 'AB202', type: 'text'    },
  { key: 'road_type_2',                  label: '接面道路の種類2行目（2本目がある場合のみ）',                         cell: 'AK202', type: 'text'    },
  { key: 'road_width_contact_2',         label: '幅員2行目（数字のみ、m除外。2本目がある場合のみ）',                  cell: 'AV202', type: 'text'    },
  { key: 'road_contact_length_2',        label: '接道長さ2行目（数字のみ、m除外。2本目がある場合のみ）',              cell: 'BD202', type: 'text'    },
  { key: 'road_facing_direction_3',      label: '接道方向3行目（例：北、南東。方位のみ。3本目の道路がある場合のみ）', cell: 'S203',  type: 'text'    },
  { key: 'road_public_private_3',        label: '公・私道の別3行目（3本目がある場合のみ）',                          cell: 'AB203', type: 'text'    },
  { key: 'road_type_3',                  label: '接面道路の種類3行目（3本目がある場合のみ）',                         cell: 'AK203', type: 'text'    },
  { key: 'road_width_contact_3',         label: '幅員3行目（数字のみ、m除外。3本目がある場合のみ）',                  cell: 'AV203', type: 'text'    },
  { key: 'road_contact_length_3',        label: '接道長さ3行目（数字のみ、m除外。3本目がある場合のみ）',              cell: 'BD203', type: 'text'    },
  // ── 建築確認・検査済証 ──
  { key: 'building_confirm_text',      label: '建築確認済証・中間検査・完了検査の情報（下記フォーマットで整形）\n・建築確認済証：平成29年12月21日 第ERI-17051659号\n・中間検査済証：平成30年10月15日 第ERI-17051659号\n・完了検査済証：令和元年9月6日 第ERI-17051659号\n存在するもののみ改行付きで出力', cell: 'H345',  type: 'text'    },
];

/**
 * GET /api/kenchiku-gaiyosho/test-sheet-access
 * スプレッドシートへのアクセスをテストするデバッグ用エンドポイント
 */
router.get('/test-sheet-access', async (req: Request, res: Response) => {
  try {
    const spreadsheetUrl = req.query.spreadsheetUrl as string;
    if (!spreadsheetUrl) {
      return res.status(400).json({ error: 'spreadsheetUrl クエリパラメータが必要です' });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'スプレッドシートIDの抽出に失敗しました', spreadsheetUrl });
    }

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: '重説',
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    // メタデータ取得テスト
    const metadata = await sheetsClient.getSpreadsheetMetadata();
    const sheetNames = metadata.sheets?.map(s => s.properties?.title || '') || [];

    // 読み取りテスト
    let readResult: string[][] = [];
    let readError: string | null = null;
    try {
      readResult = await sheetsClient.readRawRange('U39');
    } catch (e: any) {
      readError = e?.message || String(e);
    }

    // 書き込みテスト（値を読んで同じ値を書き戻す）
    let writeError: string | null = null;
    try {
      const currentValue = readResult?.[0]?.[0] || '';
      await sheetsClient.writeRawCell('U39', currentValue || 'TEST');
      // テスト値を書いた場合は元に戻す
      if (!currentValue) {
        await sheetsClient.writeRawCell('U39', '');
      }
    } catch (e: any) {
      writeError = e?.message || String(e);
    }

    return res.json({
      success: true,
      spreadsheetId,
      sheetNames,
      readTest: { cell: 'U39', value: readResult?.[0]?.[0] ?? null, error: readError },
      writeTest: { error: writeError },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'テスト失敗', stack: error?.stack?.substring(0, 500) });
  }
});

/**
 * POST /api/kenchiku-gaiyosho/analyze
 * 建築概要書等のPDF/画像を複数枚まとめて解析し、各項目の内容を抽出する
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

    const itemsDetail = GAIYOSHO_ITEMS.map((item) => `- "${item.key}": ${item.label}`).join('\n');
    const keyList = GAIYOSHO_ITEMS.map((i) => `"${i.key}": null`).join(', ');

    // 全ファイルを1リクエストにまとめて送信（バラバラな書類を横断的に解析）
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

    contentBlocks.push({
      type: 'text',
      text: `あなたは不動産の都市計画・建築規制に精通した専門家です。
添付された複数の書類（都市計画図・用途地域図・建築計画概要書・開発登録簿・重説資料・建築確認済証・検査済証など）を横断的に読み取り、以下の各項目について該当する内容を抽出してください。
書類がバラバラでも、全ての書類から情報を総合して判断してください。

【抽出するkey一覧】
${itemsDetail}

【重要ルール】
1. boolean型の項目は true または false で返すこと

   【建築計画概要書のチェックボックス判定（最重要）】
   建築計画概要書には「■」（塗りつぶし・黒四角）と「□」（空白・白四角）の2種類がある。
   - 「■」が付いている項目 → true（選択されている）
   - 「□」のみの項目 → false（選択されていない）
   例：「【4.防火地域】 □ 防火地域  ■ 準防火地域  □ 指定なし」
     → fire_zone（防火地域）= false、semi_fire_zone（準防火地域）= true
   例：「【3.都市計画区域】 ■ 都市計画区域内（■ 市街化区域  □ 市街化調整区域）」
     → city_plan_urbanized（市街化区域）= true、city_plan_adjust（市街化調整区域）= false

   【その他の書類のチェックボックス判定】
   - 「○○区域内」「○○指定あり」「○○地域」の記載がある → true
   - 「該当なし」「指定なし」「区域外」「－」の記載がある → false
   - 記載がない場合は null

   【用途地域図・都市計画図からの市街化区域判定（重要）】
   - 用途地域図に「第一種低層住居専用地域」「第二種低層住居専用地域」「第一種中高層住居専用地域」「第二種中高層住居専用地域」「第一種住居地域」「第二種住居地域」「準住居地域」「近隣商業地域」「商業地域」「準工業地域」「工業地域」「工業専用地域」などの用途地域の指定が確認できる場合、またはいずれかの用途地域に●や指定マークがある場合 → city_plan_urbanized（市街化区域）= true
   - 用途地域が指定されている土地は法律上「市街化区域」に該当するため、用途地域の記載があれば必ず市街化区域もtrueにすること
   - 建築計画概要書【3.都市計画区域等】に「■ 市街化区域」の記載がある場合も同様にtrue

2. 数値項目は単位（%・m・㎡・円）を除いて数字のみを返すこと
   - 例: "建ぺい率60%" → "60"、"幅員約6m" → "6"
   - 建築計画概要書【6.道路】の「幅員」→ road_width
   - 建築計画概要書【6.道路】の「敷地と接している部分の長さ」→ road_contact_length

3. 用途地域が2つにまたがる場合は use_zone_1 と use_zone_2 の両方に入力すること
   - 建築計画概要書【7.敷地面積等】の「用途地域等」欄を参照すること

4. 接道は最大3行分抽出すること（複数道路に接している場合は全て抽出）
   - 接道が1本 → _1 のみ入力、_2・_3 は null
   - 接道が2本 → _1・_2 に入力、_3 は null
   - 接道が3本 → _1・_2・_3 全て入力
   - 接道方向は方位のみに変換すること
     - 「南東側道路」→「南東」、「北側道路」→「北」、「東側」→「東」
   - **配置図・付近見取図からも接道方向を読み取ること**
     - 配置図に方位記号（N↑など）がある場合、建物に対して道路がどの方向にあるかを判断すること
     - 配置図の上部に道路幅員が記載されている場合は「北」、右側なら「東」、下側なら「南」、左側なら「西」
     - 付近見取図の方位記号と敷地（ハッチング部分）の位置から接道方向を判断すること
   - 接道方向の順序は書類に記載の順番通りに入力すること

5. 道路幅員制限の計算係数（road_width_coeff）の判定：
   - 用途地域が住居系（低層住居・中高層住居・住居・準住居）→ 40
   - 用途地域が非住居系（近隣商業・商業・準工業・工業等）→ 60

6. 建築確認・検査済証（building_confirm_text）の整形：
   - 必ず一番上の1行目に「市役所から交付された台帳記載事項証明書（別添）があります。」を固定で出力すること
   - その後、存在するもののみ改行で区切って出力すること
   - フォーマット例：
     市役所から交付された台帳記載事項証明書（別添）があります。
     ・建築確認済証：平成29年12月21日 第ERI-17051659号
     ・中間検査済証：平成30年10月15日 第ERI-17051659号
     ・完了検査済証：令和元年9月6日 第ERI-17051659号
   - 建築計画概要書の受付欄・確認済証番号欄から抽出すること
     例：「※確認済証番号 平成 29.12.21 第ERI-17051659号」→ 建築確認済証：平成29年12月21日 第ERI-17051659号

7. 接面道路の種類（road_type_1〜_3）は以下の選択肢から最も近いものを選ぶこと：
   ア、イ、ウ、エ、オ、カ、キ

8. 公・私道の別（road_public_private_1〜_3）は「公道」または「私道」のみ返すこと

9. 建蔽率・容積率について：
   - 建築計画概要書【7.敷地面積等】の「建築基準法第53条（建蔽率）」欄 → building_coverage_ratio
   - 建築計画概要書【7.敷地面積等】の「建築基準法第52条（容積率）」欄 → floor_area_ratio
   - 「敷地に建築可能な延べ面積を敷地面積で除した数値」= 容積率
   - 「敷地に建築可能な建築面積を敷地面積で除した数値」= 建蔽率

10. 複数の書類を横断して情報を統合すること。一枚に情報がなくても他の書類から補完すること

11. 見つからない場合はnull

12. 必ず以下のJSON形式のみで応答すること（説明文・コードブロック記号は不要）

{${keyList}}`,
    });

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    console.log('[kenchiku-gaiyosho] Claude response (first 300):', responseText.substring(0, 300));

    let extractedData: Record<string, string | null> = {};

    const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

    if (jsonStr) {
      try {
        extractedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[kenchiku-gaiyosho] JSON parse error:', parseError);
        extractedData = {};
      }
    } else {
      console.warn('[kenchiku-gaiyosho] No JSON in response:', responseText.substring(0, 200));
      extractedData = {};
    }

    const results = GAIYOSHO_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      content: extractedData[item.key] ?? null,
      found: extractedData[item.key] != null,
      cell: item.cell,
      type: item.type,
    }));

    return res.json({ success: true, fileCount: files.length, results });
  } catch (error: any) {
    console.error('[kenchiku-gaiyosho] 解析エラー:', error?.message || error);

    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({
        error: {
          code: 'rate_limit_exceeded',
          message: 'APIのレート制限に達しました。しばらく待ってから再試行してください。',
        },
      });
    }

    return res.status(500).json({ error: error?.message || '解析中にエラーが発生しました' });
  }
});

/**
 * POST /api/kenchiku-gaiyosho/write
 * 解析結果を重説シートの指定セルに書き込む
 * フロントから送られる cell 値は無視し、常に最新の GAIYOSHO_ITEMS のセルマッピングを使用する
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
    console.log(`[kenchiku-gaiyosho] 書き込み開始: spreadsheetUrl=${spreadsheetUrl}, spreadsheetId=${spreadsheetId}`);

    let sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: '重説',
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    // シート一覧を取得して「重説」シートの存在を確認
    let actualSheetName = '重説';
    try {
      const metadata = await sheetsClient.getSpreadsheetMetadata();
      const sheetNames = metadata.sheets?.map(s => s.properties?.title || '') || [];
      console.log(`[kenchiku-gaiyosho] スプレッドシート内シート一覧: [${sheetNames.join(', ')}] (spreadsheetId: ${spreadsheetId})`);
      
      const exactMatch = sheetNames.find(name => name === '重説');
      if (!exactMatch) {
        // 前後スペースを無視した部分一致で探す
        const fuzzyMatch = sheetNames.find(name => name.trim() === '重説' || name.includes('重説'));
        if (fuzzyMatch) {
          console.log(`[kenchiku-gaiyosho] 「重説」完全一致なし。類似シート「${fuzzyMatch}」を使用します`);
          actualSheetName = fuzzyMatch;
        } else {
          return res.status(400).json({
            error: `スプレッドシートに「重説」シートが見つかりません。存在するシート: [${sheetNames.join(', ')}]`,
          });
        }
      }
    } catch (metaError: any) {
      console.error(`[kenchiku-gaiyosho] メタデータ取得エラー: ${metaError?.message} (spreadsheetId: ${spreadsheetId})`);
      // メタデータ取得に失敗してもそのまま書き込み試行を続ける
    }

    // actualSheetNameが「重説」と異なる場合、新しいクライアントを作成
    if (actualSheetName !== '重説') {
      sheetsClient = new GoogleSheetsClient({
        spreadsheetId,
        sheetName: actualSheetName,
        serviceAccountKeyPath:
          process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
      });
      await sheetsClient.authenticate();
    }

    // 常に最新のセルマッピングを使う（キャッシュずれ防止）
    const itemMap = new Map(GAIYOSHO_ITEMS.map((i) => [i.key, i]));

    let writtenCount = 0;

    // 道路幅員の数値を取得（12m未満/以上の自動判定に使う）
    // 複数接道がある場合は最大幅員で判定
    const roadWidthKeys = ['road_width_contact_1', 'road_width_contact_2', 'road_width_contact_3'];
    const roadWidths = roadWidthKeys
      .map((key) => results.find((r) => r.key === key)?.content)
      .filter((v): v is string => v !== null && v !== undefined)
      .map((v) => parseFloat(v))
      .filter((v) => !isNaN(v));
    const maxRoadWidth = roadWidths.length > 0 ? Math.max(...roadWidths) : null;

    for (const r of results) {
      const master = itemMap.get(r.key);
      if (!master || !master.cell) continue;
      if (r.content === null || r.content === undefined || r.content === '') continue;

      let writeValue: string;

      // 道路幅員12m未満/以上は数値から自動判定（AIの判断を使わない）
      if (r.key === 'road_width_under_12m') {
        if (maxRoadWidth !== null) {
          writeValue = maxRoadWidth < 12 ? 'TRUE' : 'FALSE';
          console.log(`[kenchiku-gaiyosho] 12m未満自動判定: 最大幅員${maxRoadWidth}m → ${writeValue}`);
        } else {
          continue;
        }
      } else if (r.key === 'road_width_over_12m') {
        if (maxRoadWidth !== null) {
          writeValue = maxRoadWidth >= 12 ? 'TRUE' : 'FALSE';
          console.log(`[kenchiku-gaiyosho] 12m以上自動判定: 最大幅員${maxRoadWidth}m → ${writeValue}`);
        } else {
          continue;
        }
      } else if (master.type === 'boolean') {
        const boolVal = r.content === 'true' || (r.content as any) === true;
        writeValue = boolVal ? 'TRUE' : 'FALSE';
      } else {
        writeValue = r.content;
      }

      await sheetsClient.writeRawCell(master.cell, writeValue);
      console.log(`[kenchiku-gaiyosho] 書き込み完了: ${master.cell} = ${writeValue}`);
      writtenCount++;
    }

    // 道路幅員が取得できているが12m未満/以上の結果がresultsになかった場合も書き込む
    if (maxRoadWidth !== null) {
      const under12 = results.find((r) => r.key === 'road_width_under_12m');
      const over12 = results.find((r) => r.key === 'road_width_over_12m');
      const under12Master = itemMap.get('road_width_under_12m');
      const over12Master = itemMap.get('road_width_over_12m');

      if ((!under12 || under12.content === null) && under12Master?.cell) {
        const val = maxRoadWidth < 12 ? 'TRUE' : 'FALSE';
        await sheetsClient.writeRawCell(under12Master.cell, val);
        console.log(`[kenchiku-gaiyosho] 12m未満補完書き込み: ${under12Master.cell} = ${val}`);
        writtenCount++;
      }
      if ((!over12 || over12.content === null) && over12Master?.cell) {
        const val = maxRoadWidth >= 12 ? 'TRUE' : 'FALSE';
        await sheetsClient.writeRawCell(over12Master.cell, val);
        console.log(`[kenchiku-gaiyosho] 12m以上補完書き込み: ${over12Master.cell} = ${val}`);
        writtenCount++;
      }
    }

    // 用途地域が取得できていれば市街化区域を自動でtrueにする（用途地域がある＝市街化区域）
    const useZone1 = results.find((r) => r.key === 'use_zone_1');
    const useZone2 = results.find((r) => r.key === 'use_zone_2');
    const hasUseZone = (useZone1?.content && useZone1.content !== '') || (useZone2?.content && useZone2.content !== '');
    if (hasUseZone) {
      const urbanizedMaster = itemMap.get('city_plan_urbanized');
      if (urbanizedMaster?.cell) {
        const urbanizedResult = results.find((r) => r.key === 'city_plan_urbanized');
        // AIがfalseと返していても用途地域があればtrueで上書き
        if (!urbanizedResult || urbanizedResult.content !== 'true') {
          await sheetsClient.writeRawCell(urbanizedMaster.cell, 'TRUE');
          console.log(`[kenchiku-gaiyosho] 用途地域あり→市街化区域自動補正: ${urbanizedMaster.cell} = TRUE`);
          writtenCount++;
        }
      }
    }

    return res.json({
      success: true,
      message: `重説シートへの書き込みが完了しました（${writtenCount}セル）`,
      writtenCount,
    });
  } catch (error: any) {
    console.error('[kenchiku-gaiyosho] 書き込みエラー:', error?.message || error);
    const msg = error?.message || '書き込み中にエラーが発生しました';
    // Google Sheets APIのレンジエラーを親切なメッセージに変換
    if (msg.includes('Unable to parse range')) {
      return res.status(400).json({
        error: `シートへのアクセスに失敗しました。以下を確認してください：\n① スプレッドシートがサービスアカウントに共有されているか\n② 「重説」シートが存在するか（シート名にスペースがないか）\n\n（詳細: ${msg}）`,
      });
    }
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/kenchiku-gaiyosho/save
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
      .from('kenchiku_gaiyosho_results')
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
      console.error('[kenchiku-gaiyosho/save] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[kenchiku-gaiyosho/save] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/kenchiku-gaiyosho/:propertyNumber
 * 物件番号で保存済み解析結果を取得
 */
router.get('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('kenchiku_gaiyosho_results')
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

export default router;
