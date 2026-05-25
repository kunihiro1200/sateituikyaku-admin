import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const getSupabase = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

interface LandEntry {
  chiban: string;          // 地番
  area?: string;           // 地積/面積
  type?: string;           // 地目
  notes?: string;          // 備考（付属建物など）
}

interface BuildingEntry {
  kaokuBango?: string;     // 家屋番号
  chiban?: string;         // 所在地番
  kind?: string;           // 種類
  structure?: string;      // 構造
  area?: string;           // 床面積
  isAttached?: boolean;    // 付属建物か
  notes?: string;
}

interface ParsedDocument {
  lands: LandEntry[];
  buildings: BuildingEntry[];
  rawText?: string;
}

interface DiffItem {
  category: 'land' | 'building';
  diffType: 'only_in_toki' | 'only_in_kazei' | 'area_mismatch' | 'type_mismatch' | 'attached_building';
  description: string;
  tokiValue?: string;
  kazeiValue?: string;
  chiban?: string;
}

/**
 * POST /api/kotei-kazei-compare/analyze
 * 謄本と固定資産税公課証明書を比較して差分を抽出
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { tokiFiles, kazeiFiles } = req.body as {
      tokiFiles: Array<{ name: string; mimeType: string; base64: string }>;
      kazeiFiles: Array<{ name: string; mimeType: string; base64: string }>;
    };

    if (!tokiFiles || tokiFiles.length === 0) {
      return res.status(400).json({ error: '謄本ファイルが選択されていません' });
    }
    if (!kazeiFiles || kazeiFiles.length === 0) {
      return res.status(400).json({ error: '公課証明ファイルが選択されていません' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
    }

    const client = new Anthropic({ apiKey });

    // 謄本を解析
    const tokiParsed = await parseDocument(client, tokiFiles, 'toki');
    // 公課証明を解析
    const kazeiParsed = await parseDocument(client, kazeiFiles, 'kazei');

    // 差分を計算
    const diffs = computeDiffs(tokiParsed, kazeiParsed);

    return res.json({
      success: true,
      toki: tokiParsed,
      kazei: kazeiParsed,
      diffs,
      diffCount: diffs.length,
    });
  } catch (error: any) {
    console.error('[kotei-kazei-compare] 解析エラー:', error?.message || error);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'APIのレート制限に達しました。しばらく待ってから再試行してください。' });
    }
    return res.status(500).json({ error: error?.message || '解析中にエラーが発生しました' });
  }
});

/**
 * Claude APIでドキュメントを解析して土地・建物エントリを抽出
 */
async function parseDocument(
  client: Anthropic,
  files: Array<{ name: string; mimeType: string; base64: string }>,
  docType: 'toki' | 'kazei'
): Promise<ParsedDocument> {
  const contentBlocks: Anthropic.ContentBlockParam[] = [];

  for (const file of files) {
    if (file.mimeType === 'application/pdf') {
      contentBlocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.base64 },
      } as any);
    } else {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: file.base64,
        },
      });
    }
  }

  const promptToki = `あなたは不動産登記の専門家です。
添付された「登記事項証明書（謄本）」を読み取り、以下の情報を全て抽出してください。
複数枚の謄本が含まれている場合は全て抽出し、重複を除いて統合してください。

【区分建物（マンション）謄本の読み方】
区分建物の謄本は以下の構造になっています：

(A) 一棟の建物の表示（共通部分）
   - 所在・建物名称・構造・各階床面積
   - 敷地権の目的である土地の表示（土地情報はここから取得）

(B) 専有部分の建物の表示（各区画）
   - 家屋番号（例：中島町 2438番1の1 → "2438-1-1"）
   - 種類・構造・床面積
   - 「附属建物の表示」がある場合、その附属建物も別エントリとして抽出

【抽出内容】
1. 土地（一棟の表示内「敷地権の目的である土地」から）：
   - 地番（chiban）: 番号のみ（町名除く）例 "別府市中島町2438番1" → "2438-1"、"別府市中島町2415番2" → "2415-2"
   - 地目（type）: 例 "宅地"
   - 地積（area）: 数字のみ（㎡除外、「：」は小数点として扱う）例 "1285：32" → "1285.32"

2. 建物（専有部分ごとに）：
   - 家屋番号（kaokuBango）: 「2438番1の1」→「2438-1-1」のように変換
   - 所在地番（chiban）: 番号のみ
   - 種類（kind）: 例 "管理事務室"、"物置"、"居宅"、"便所"
   - 構造（structure）: 例 "鉄筋コンクリート造1階建"
   - 床面積（area）: 数字のみ（「：」は小数点、例 "7：31" → "7.31"、"3：02" → "3.02"）
   - 付属建物かどうか（isAttached）: 「附属建物の表示」に記載されている建物はtrue、専有部分本体はfalse

【附属建物の扱い（重要）】
「附属建物の表示」セクションに記載されている建物（便所・物置・車庫など）は、
親となる専有部分の家屋番号 + "附属N" をkaokuBangoとして別エントリで抽出すること。
例：家屋番号2438-1-1の附属建物・符号1（便所）→ kaokuBango: "2438-1-1-附属1"、isAttached: true

【面積の読み方】
謄本では面積が「1285：32」のように「：」で区切られている場合、これは「1285.32㎡」を意味する。
「7：31」→「7.31」、「0：87」→「0.87」、「1：00」→「1.00"」

【出力形式】必ずJSON形式のみで返すこと：
{
  "lands": [
    {"chiban": "2438-1", "type": "宅地", "area": "1285.32"},
    {"chiban": "2415-2", "type": "宅地", "area": "442.31"}
  ],
  "buildings": [
    {"kaokuBango": "2438-1-1", "chiban": "2438-1", "kind": "管理事務室", "structure": "鉄筋コンクリート造1階建", "area": "7.31", "isAttached": false},
    {"kaokuBango": "2438-1-1-附属1", "chiban": "2438-1", "kind": "便所", "structure": "鉄筋コンクリート造1階建", "area": "1.00", "isAttached": true},
    {"kaokuBango": "2438-1-1-附属2", "chiban": "2438-1", "kind": "物置", "structure": "鉄筋コンクリート造1階建", "area": "0.87", "isAttached": true},
    {"kaokuBango": "2438-1-2", "chiban": "2438-1", "kind": "物置", "structure": "鉄筋コンクリート造1階建", "area": "3.02", "isAttached": false}
  ]
}`;

  const promptKazei = `あなたは不動産の専門家です。
添付された「固定資産公課証明書」「固定資産税・都市計画税公課証明書」または「固定資産評価証明書」を読み取り、以下の情報を全て抽出してください。
複数の書類が含まれている場合は全て抽出してください。

【固定資産公課証明書の読み方】
この書類は表形式になっており、以下の列構成です：
- 種類（土地 or 家屋）
- 地目（登記・現況）または 家屋構造・種類
- 登記地積・現況地積・床面積
- 建築年
- 固定資産税課税標準額
- 都市計画税課税標準額
- 公課額
- 家屋番号
- 登記名義人等
- 備考

【抽出内容】
1. 土地（「種類」欄が「土地」の行ごとに）：
   - 地番（chiban）: 「所在地」欄または行の先頭にある地番 例 "中島町2438-1" → "2438-1"、"中島町2415-2" → "2415-2"（町名は除いて地番のみ）
   - 地目（type）: 「地目（登記・現況）」欄 例 "宅地"
   - 地積（area）: 「現況地積」欄の数字のみ（㎡除外）例 "1285.32"

2. 建物（「種類」欄が「家屋」の行ごとに）：
   - 家屋番号（kaokuBango）: 「家屋番号」欄 例 "2438-1-1502"、"2438-1-1"
   - 所在地番（chiban）: 「所在地」欄の地番部分のみ（町名除く）
   - 種類（kind）: 「家屋構造・種類」の種類部分 例 "居宅"、"管理(人)室"、"便所"、"物置"、"車庫"
   - 構造（structure）: 「家屋構造・種類」の構造部分 例 "鉄筋コンクリート"、"木造"
   - 床面積（area）: 「床面積」欄の数字のみ（㎡除外）例 "72.29"
   - 付属建物かどうか（isAttached）: 居宅・共同住宅・事務所などのメイン建物以外（管理室・便所・物置・車庫・倉庫など）はtrue

【重要ルール】
- 地番は町名・市名を除いた番号部分のみを返すこと（例：「中島町2438-1」→「2438-1"」）
- 家屋が複数行（構造と種類が別行など）になっている場合は1つの建物としてまとめること
- 「以下余白」は無視すること
- 床面積が空欄（登録欄が空）の建物は面積なしとして扱うこと

【出力形式】必ずJSON形式のみで返すこと：
{
  "lands": [
    {"chiban": "2415-2", "type": "宅地", "area": "442.31"},
    {"chiban": "2438-1", "type": "宅地", "area": "1285.32"}
  ],
  "buildings": [
    {"kaokuBango": "2438-1-1502", "chiban": "2438-1", "kind": "居宅", "structure": "鉄筋コンクリート", "area": "72.29", "isAttached": false},
    {"kaokuBango": "2438-1-1", "chiban": "2438-1", "kind": "管理(人)室", "structure": "鉄筋コンクリート", "area": "0.12", "isAttached": true},
    {"kaokuBango": "2438-1-1", "chiban": "2438-1", "kind": "便所", "structure": "鉄筋コンクリート", "area": "0.01", "isAttached": true},
    {"kaokuBango": "2438-1-1", "chiban": "2438-1", "kind": "物置", "structure": "鉄筋コンクリート", "area": "0.01", "isAttached": true},
    {"kaokuBango": "2438-1-2", "chiban": "2438-1", "kind": "物置", "structure": "鉄筋コンクリート", "area": "0.05", "isAttached": true}
  ]
}`;

  contentBlocks.push({
    type: 'text',
    text: docType === 'toki' ? promptToki : promptKazei,
  });

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  console.log(`[kotei-kazei-compare] ${docType} response (first 300):`, responseText.substring(0, 300));

  const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonRawMatch = responseText.match(/\{[\s\S]*\}/);
  const jsonStr = jsonBlockMatch?.[1] ?? jsonRawMatch?.[0] ?? null;

  if (jsonStr) {
    try {
      return JSON.parse(jsonStr) as ParsedDocument;
    } catch {
      console.error(`[kotei-kazei-compare] ${docType} JSON parse error`);
    }
  }

  return { lands: [], buildings: [] };
}

/**
 * 謄本と公課証明の差分を計算
 */
function computeDiffs(toki: ParsedDocument, kazei: ParsedDocument): DiffItem[] {
  const diffs: DiffItem[] = [];

  // ── 土地の差分 ──
  const tokiLandMap = new Map(toki.lands.map((l) => [normalizeChiban(l.chiban), l]));
  const kazeiLandMap = new Map(kazei.lands.map((l) => [normalizeChiban(l.chiban), l]));

  // 謄本にあって公課証明にない地番
  for (const [chiban, tokiLand] of tokiLandMap) {
    if (!kazeiLandMap.has(chiban)) {
      diffs.push({
        category: 'land',
        diffType: 'only_in_toki',
        description: `地番「${tokiLand.chiban}」が謄本にあるが公課証明にない`,
        tokiValue: `地番: ${tokiLand.chiban}、地目: ${tokiLand.type ?? '-'}、地積: ${tokiLand.area ?? '-'}㎡`,
        chiban: tokiLand.chiban,
      });
    }
  }

  // 公課証明にあって謄本にない地番
  for (const [chiban, kazeiLand] of kazeiLandMap) {
    if (!tokiLandMap.has(chiban)) {
      diffs.push({
        category: 'land',
        diffType: 'only_in_kazei',
        description: `地番「${kazeiLand.chiban}」が公課証明にあるが謄本にない`,
        kazeiValue: `地番: ${kazeiLand.chiban}、地目: ${kazeiLand.type ?? '-'}、地積: ${kazeiLand.area ?? '-'}㎡`,
        chiban: kazeiLand.chiban,
      });
    }
  }

  // 両方にある地番で面積・地目の差分
  for (const [chiban, tokiLand] of tokiLandMap) {
    const kazeiLand = kazeiLandMap.get(chiban);
    if (!kazeiLand) continue;

    // 面積の差分
    if (tokiLand.area && kazeiLand.area && normalizeArea(tokiLand.area) !== normalizeArea(kazeiLand.area)) {
      diffs.push({
        category: 'land',
        diffType: 'area_mismatch',
        description: `地番「${tokiLand.chiban}」の地積が異なる`,
        tokiValue: `${tokiLand.area}㎡（謄本）`,
        kazeiValue: `${kazeiLand.area}㎡（公課証明）`,
        chiban: tokiLand.chiban,
      });
    }

    // 地目の差分
    if (tokiLand.type && kazeiLand.type && normalizeName(tokiLand.type) !== normalizeName(kazeiLand.type)) {
      diffs.push({
        category: 'land',
        diffType: 'type_mismatch',
        description: `地番「${tokiLand.chiban}」の地目が異なる`,
        tokiValue: `${tokiLand.type}（謄本）`,
        kazeiValue: `${kazeiLand.type}（公課証明）`,
        chiban: tokiLand.chiban,
      });
    }
  }

  // ── 建物の差分 ──
  const tokiBuildMap = new Map(toki.buildings.map((b) => [normalizeBuildingKey(b), b]));
  const kazeiBuildMap = new Map(kazei.buildings.map((b) => [normalizeBuildingKey(b), b]));

  // 謄本にあって公課証明にない建物
  for (const [key, tokiBuild] of tokiBuildMap) {
    if (!kazeiBuildMap.has(key)) {
      const label = tokiBuild.isAttached ? '付属建物' : '建物';
      diffs.push({
        category: 'building',
        diffType: tokiBuild.isAttached ? 'attached_building' : 'only_in_toki',
        description: `${label}「家屋番号: ${tokiBuild.kaokuBango ?? tokiBuild.chiban}」が謄本にあるが公課証明にない`,
        tokiValue: `種類: ${tokiBuild.kind ?? '-'}、構造: ${tokiBuild.structure ?? '-'}、床面積: ${tokiBuild.area ?? '-'}㎡`,
        chiban: tokiBuild.chiban,
      });
    }
  }

  // 公課証明にあって謄本にない建物
  for (const [key, kazeiBuild] of kazeiBuildMap) {
    if (!tokiBuildMap.has(key)) {
      const label = kazeiBuild.isAttached ? '付属建物' : '建物';
      diffs.push({
        category: 'building',
        diffType: kazeiBuild.isAttached ? 'attached_building' : 'only_in_kazei',
        description: `${label}「家屋番号: ${kazeiBuild.kaokuBango ?? kazeiBuild.chiban}」が公課証明にあるが謄本にない`,
        kazeiValue: `種類: ${kazeiBuild.kind ?? '-'}、構造: ${kazeiBuild.structure ?? '-'}、床面積: ${kazeiBuild.area ?? '-'}㎡`,
        chiban: kazeiBuild.chiban,
      });
    }
  }

  // 両方にある建物で面積差分
  for (const [key, tokiBuild] of tokiBuildMap) {
    const kazeiBuild = kazeiBuildMap.get(key);
    if (!kazeiBuild) continue;

    if (tokiBuild.area && kazeiBuild.area && normalizeArea(tokiBuild.area) !== normalizeArea(kazeiBuild.area)) {
      diffs.push({
        category: 'building',
        diffType: 'area_mismatch',
        description: `建物「家屋番号: ${tokiBuild.kaokuBango ?? tokiBuild.chiban}」の床面積が異なる`,
        tokiValue: `${tokiBuild.area}㎡（謄本）`,
        kazeiValue: `${kazeiBuild.area}㎡（公課証明）`,
        chiban: tokiBuild.chiban,
      });
    }
  }

  return diffs;
}

// 地番の正規化（スペース・ハイフン表記ゆれ対応）
function normalizeChiban(chiban: string): string {
  return chiban.replace(/\s+/g, '').replace(/－/g, '-').replace(/ー/g, '-').toLowerCase();
}

// 面積の正規化（小数点以下の表記ゆれ対応）
function normalizeArea(area: string): string {
  const num = parseFloat(area.replace(/[^\d.]/g, ''));
  return isNaN(num) ? area.trim() : num.toFixed(2);
}

// 名称の正規化
function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/管理\(人\)室/, '管理事務室')  // 公課証明の「管理(人)室」≒謄本の「管理事務室」
    .replace(/管理室/, '管理事務室')
    .toLowerCase();
}

// 建物のキー（附属建物は親家屋番号+種類で照合、通常は家屋番号）
function normalizeBuildingKey(b: BuildingEntry): string {
  if (b.isAttached) {
    // 附属建物は親地番+種類でマッチング（"2438-1-1-附属1"→親"2438-1-1"と種類"便所"）
    const parentNo = normalizeChiban((b.kaokuBango ?? '').replace(/-附属\d+$/, '').replace(/附属\d+$/, '') || b.chiban || '');
    return `attached:${parentNo}:${normalizeName(b.kind ?? '')}`;
  }
  return b.kaokuBango
    ? normalizeChiban(b.kaokuBango)
    : `${normalizeChiban(b.chiban ?? '')}:${normalizeName(b.kind ?? '')}`;
}

/**
 * POST /api/kotei-kazei-compare/save
 * 比較結果をDBに保存
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { propertyNumber, toki, kazei, diffs } = req.body as {
      propertyNumber: string;
      toki: ParsedDocument;
      kazei: ParsedDocument;
      diffs: DiffItem[];
    };

    if (!propertyNumber) {
      return res.status(400).json({ error: 'propertyNumber は必須です' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('kotei_kazei_compare_results')
      .upsert(
        {
          property_number: propertyNumber,
          toki_data: toki,
          kazei_data: kazei,
          diffs,
          diff_count: diffs.length,
          analyzed_at: new Date().toISOString(),
        },
        { onConflict: 'property_number' }
      )
      .select()
      .single();

    if (error) {
      console.error('[kotei-kazei-compare/save] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/kotei-kazei-compare/:propertyNumber
 * 保存済み比較結果を取得
 */
router.get('/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('kotei_kazei_compare_results')
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
