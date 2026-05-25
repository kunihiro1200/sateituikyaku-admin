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
  // ── 接道 ──
  { key: 'road_facing_direction',      label: '接道方向（例：南、東南。「南東側道路」→「南東」に変換）',                  cell: 'S201',  type: 'text'    },
  { key: 'road_public_private',        label: '公・私道の別（「公道」または「私道」）',                                   cell: 'AB201', type: 'text'    },
  { key: 'road_type',                  label: '接面道路の種類（ア〜キの選択肢から一致するものを入力）',                   cell: 'AK201', type: 'text'    },
  { key: 'road_width_contact',         label: '幅員（数字のみ、m除外）',                                                 cell: 'AV201', type: 'text'    },
  { key: 'road_contact_length',        label: '接道長さ（数字のみ、m除外）',                                             cell: 'BD201', type: 'text'    },
  // ── 建築確認・検査済証 ──
  { key: 'building_confirm_text',      label: '建築確認済証・中間検査・完了検査の情報（下記フォーマットで整形）\n・建築確認済証：平成29年12月21日 第ERI-17051659号\n・中間検査済証：平成30年10月15日 第ERI-17051659号\n・完了検査済証：令和元年9月6日 第ERI-17051659号\n存在するもののみ改行付きで出力', cell: 'H345',  type: 'text'    },
];

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
   - 「○○区域内」「○○指定あり」「○○地域」の記載がある → true
   - 「該当なし」「指定なし」「区域外」「－」の記載がある → false
   - 記載がない場合は null
2. 数値項目は単位（%・m・㎡・円）を除いて数字のみを返すこと
   - 例: "建ぺい率60%" → "60"、"幅員約6m" → "6"
3. 用途地域が2つにまたがる場合は use_zone_1 と use_zone_2 の両方に入力すること
4. 接道方向は方向に変換すること
   - 「南東側道路」→「南東」、「北西道路」→「北西」
5. 道路幅員制限の計算係数（road_width_coeff）の判定：
   - 用途地域が住居系（低層住居・中高層住居・住居・準住居）→ 40
   - 用途地域が非住居系（近隣商業・商業・準工業・工業等）→ 60
6. 建築確認・検査済証（building_confirm_text）の整形：
   - 存在するもののみ出力し、改行で区切ること
   - フォーマット例：
     ・建築確認済証：平成29年12月21日 第ERI-17051659号
     ・中間検査済証：平成30年10月15日 第ERI-17051659号
     ・完了検査済証：令和元年9月6日 第ERI-17051659号
7. 接面道路の種類（road_type）は以下の選択肢から最も近いものを選ぶこと：
   ア、イ、ウ、エ、オ、カ、キ
8. 公・私道の別（road_public_private）は「公道」または「私道」のみ返すこと
9. 複数の書類を横断して情報を統合すること。一枚に情報がなくても他の書類から補完すること
10. 見つからない場合はnull
11. 必ず以下のJSON形式のみで応答すること（説明文・コードブロック記号は不要）

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

    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId,
      sheetName: '重説',
      serviceAccountKeyPath:
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();

    // 常に最新のセルマッピングを使う（キャッシュずれ防止）
    const itemMap = new Map(GAIYOSHO_ITEMS.map((i) => [i.key, i]));

    let writtenCount = 0;

    for (const r of results) {
      const master = itemMap.get(r.key);
      if (!master || !master.cell) continue;
      if (r.content === null || r.content === undefined || r.content === '') continue;

      let writeValue: string;
      if (master.type === 'boolean') {
        const boolVal = r.content === 'true' || (r.content as any) === true;
        writeValue = boolVal ? 'TRUE' : 'FALSE';
      } else {
        writeValue = r.content;
      }

      await sheetsClient.writeRawCell(master.cell, writeValue);
      console.log(`[kenchiku-gaiyosho] 書き込み完了: ${master.cell} = ${writeValue}`);
      writtenCount++;
    }

    return res.json({
      success: true,
      message: `重説シートへの書き込みが完了しました（${writtenCount}セル）`,
      writtenCount,
    });
  } catch (error: any) {
    console.error('[kenchiku-gaiyosho] 書き込みエラー:', error?.message || error);
    return res.status(500).json({ error: error?.message || '書き込み中にエラーが発生しました' });
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
