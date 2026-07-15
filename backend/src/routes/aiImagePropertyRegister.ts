/**
 * 他社物件：画像からAIで物件情報を読み取り、property_listingsに登録するAPI
 * POST /api/ai/extract-and-register-property
 * POST /api/ai/extract-property-preview （登録前プレビュー用）
 */
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import supabase from '../config/supabase';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** 当社情報（都道府県別） */
const OWN_COMPANY_INFO: Record<'福岡' | '大分', { company_name: string }> = {
  福岡: {
    company_name:
      '株式会社くじら不動産　〒810-0073 福岡市中央区舞鶴3-1-10　TEL:092-401-5331　mail:tenant@ifoo-oita.com',
  },
  大分: {
    company_name:
      '株式会社いふう　〒870-0021 大分市舞鶴町1-3-30　TEL:097-533-2022　mail:tenant@ifoo-oita.com',
  },
};

/**
 * 次の他社物件番号を採番する
 * FT = 他社物件 福岡 (FukuokaTasha)
 * OT = 他社物件 大分 (OitaTasha)
 */
async function getNextTashaPropertyNumber(
  prefix: 'FT' | 'OT'
): Promise<string> {
  // property_listingsから同プレフィックスの最大番号を取得
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number')
    .ilike('property_number', `${prefix}%`)
    .order('property_number', { ascending: false });

  if (error) throw new Error(`採番エラー: ${error.message}`);

  let maxNum = 0;
  if (data && data.length > 0) {
    for (const row of data) {
      const num = parseInt(((row as any).property_number || '').replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `${prefix}${maxNum + 1}`;
}

/**
 * Claudeに画像を送って物件情報を抽出する
 */
async function extractPropertyFromImage(
  imageBase64: string,
  mediaType: string
): Promise<{
  prefecture: string;
  address: string;
  price: number | null;
  property_type: string;
  land_area: string | null;
  building_area: string | null;
  floor_plan: string | null;
  build_year: number | null;
  access: string | null;
  youto_chiiki: string | null;
  building_coverage_ratio: string | null;
  floor_area_ratio: string | null;
  road_access: string | null;
  remarks: string | null;
  raw_address_prefecture: string;
  issuing_company: string | null;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません');

  const client = new Anthropic({ apiKey });

  const prompt = `この画像は不動産の物件概要書です。以下の情報を読み取り、JSON形式で返してください。

抽出する項目：
- prefecture: 都道府県名（「福岡県」または「大分県」など）
- address: 物件所在地（住所の全文）
- price: 価格（数値のみ、単位なし。「390,000,000円」→ 390000000。不明ならnull）
- property_type: 種別（「土地」「戸建て」「マンション」「商業用地」など）
- land_area: 土地面積（「1,633.01㎡」など、単位付き文字列。不明ならnull）
- building_area: 建物面積（不明ならnull）
- floor_plan: 間取り（不明ならnull）
- build_year: 築年（西暦数値。不明ならnull）
- access: 交通アクセス（最寄り駅・バス停など。不明ならnull）
- youto_chiiki: 用途地域（「第1種住居地域」など。不明ならnull）
- building_coverage_ratio: 建蔽率（「60%」など。不明ならnull）
- floor_area_ratio: 容積率（「200%」など。不明ならnull）
- road_access: 道路接道状況（不明ならnull）
- remarks: 備考・注意事項（不明ならnull）
- raw_address_prefecture: 住所・会社住所・画像内のあらゆる情報から判断した都道府県
- issuing_company: 概要書の発行会社情報（左下や右下に記載の不動産会社名・住所・電話番号など。例:「株式会社オープンハウス・ディベロップメント 福岡支社 〒810-0001 福岡市中央区天神1-10-20 TEL:092-718-1831」。不明ならnull）

raw_address_prefecture の判断ルール（重要）：
- 住所に「福岡」「博多」「北九州」「久留米」「八幡」「小倉」「門司」「戸畑」「若松」「福岡市」「北九州市」「久留米市」「飯塚市」などが含まれる → "福岡"
- 住所に「大分」「別府」「中津」「日田」「佐伯」「臼杵」「津久見」「竹田」「豊後」「宇佐」「杵築」「大分市」「別府市」などが含まれる → "大分"
- 郵便番号で判断（810〜839は福岡、870〜879は大分の範囲が多い）
- 会社の住所や問い合わせ先の住所も参考にする
- 上記いずれでも判断できない場合 → "その他"
- 必ずどちらか一方に寄せること。「その他」は最終手段

priceは税込・税抜問わず記載の数値をそのまま取得。
画像フォーマットは問いません（表形式・チラシ形式・縦書きなど何でも対応）。

JSONのみを返してください。説明文は不要です。`;

  const isPdf = mediaType === 'application/pdf';

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          isPdf
            ? {
                type: 'document' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'application/pdf' as const,
                  data: imageBase64,
                },
              }
            : {
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: imageBase64,
                },
              },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const responseText = response.content
    .filter((b) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  console.log('[AI Image Extract] Claude response:', responseText.substring(0, 600));

  // JSONを抽出
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                    responseText.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : responseText;

  return JSON.parse(jsonText);
}

/**
 * POST /api/ai/extract-property-preview
 * 画像からAI抽出してプレビュー表示（登録はしない）
 */
router.post('/extract-property-preview', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 と mediaType が必要です' });
    }

    const extracted = await extractPropertyFromImage(imageBase64, mediaType);

    // 採番のプレビュー
    const prefix = extracted.raw_address_prefecture === '福岡' ? 'FT' : 'OT';
    const nextNumber = await getNextTashaPropertyNumber(prefix);

    return res.json({
      extracted,
      preview: {
        property_number: nextNumber,
        prefix,
        prefecture_label: extracted.raw_address_prefecture === '福岡' ? '福岡' : '大分',
      },
    });
  } catch (error: any) {
    console.error('[AI Image Extract Preview] Error:', error);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'AI APIのリクエスト制限に達しました。少し待ってから再試行してください。' });
    }
    return res.status(500).json({ error: '画像解析に失敗しました', details: error?.message });
  }
});

/**
 * POST /api/ai/extract-and-register-property
 * 画像からAI抽出して property_listings に登録
 */
router.post('/extract-and-register-property', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, overrides } = req.body;
    // overrides: ユーザーが確認画面で修正した値（任意）

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 と mediaType が必要です' });
    }

    // 1. AI抽出
    const extracted = await extractPropertyFromImage(imageBase64, mediaType);

    // 2. ユーザーの修正値をマージ
    const merged = { ...extracted, ...(overrides || {}) };

    // 3. 都道府県を元にプレフィックスを決定
    const prefecture = merged.raw_address_prefecture;
    const prefix: 'FT' | 'OT' = prefecture === '福岡' ? 'FT' : 'OT';
    const sidebarCategory = prefecture === '福岡' ? '他社物件_福岡' : '他社物件_大分';

    // 4. 採番
    const propertyNumber = await getNextTashaPropertyNumber(prefix);

    // 5. property_listingsに挿入
    const ownCompany = OWN_COMPANY_INFO[prefecture as '福岡' | '大分'] ?? OWN_COMPANY_INFO['大分'];

    const insertData: Record<string, any> = {
      property_number: propertyNumber,
      address: merged.address || null,
      property_type: merged.property_type || null,
      price: merged.price || null,
      sidebar_status: sidebarCategory,
      // 他社物件フラグとして使えるよう atbb_status に設定
      atbb_status: '他社物件',
      confirmation: '済',
      // 発行会社（他社）を特記に保存
      special_notes: merged.issuing_company || null,
      // 当社情報で取引業者を上書き
      company_name: ownCompany.company_name,
    };

    // 任意フィールドを追加
    if (merged.access) insertData['access'] = merged.access;
    if (merged.youto_chiiki) insertData['youto_chiiki'] = merged.youto_chiiki;
    if (merged.land_area) insertData['land_area_text'] = merged.land_area;
    if (merged.building_area) insertData['building_area_text'] = merged.building_area;
    if (merged.floor_plan) insertData['floor_plan'] = merged.floor_plan;
    if (merged.build_year) insertData['build_year'] = merged.build_year;
    if (merged.building_coverage_ratio) insertData['building_coverage_ratio'] = merged.building_coverage_ratio;
    if (merged.floor_area_ratio) insertData['floor_area_ratio'] = merged.floor_area_ratio;
    if (merged.road_access) insertData['road_access'] = merged.road_access;
    if (merged.remarks) insertData['report_memo'] = merged.remarks;

    const { data: inserted, error: insertError } = await supabase
      .from('property_listings')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[AI Register] Supabase insert error:', insertError);
      // カラムが存在しない場合は最小限のデータで再試行
      const minimalData = {
        property_number: propertyNumber,
        address: merged.address || null,
        property_type: merged.property_type || null,
        price: merged.price || null,
        sidebar_status: sidebarCategory,
        atbb_status: '他社物件',
        confirmation: '済',
      };
      const { data: retryInserted, error: retryError } = await supabase
        .from('property_listings')
        .insert(minimalData)
        .select()
        .single();

      if (retryError) {
        return res.status(500).json({ error: '物件登録に失敗しました', details: retryError.message });
      }
      return res.status(201).json({
        propertyNumber,
        inserted: retryInserted,
        extracted: merged,
        prefecture_label: prefecture === '福岡' ? '福岡' : '大分',
      });
    }

    console.log(`[AI Register] 他社物件登録成功: ${propertyNumber} (${sidebarCategory})`);

    return res.status(201).json({
      propertyNumber,
      inserted,
      extracted: merged,
      prefecture_label: prefecture === '福岡' ? '福岡' : '大分',
    });
  } catch (error: any) {
    console.error('[AI Image Extract Register] Error:', error);
    if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
      return res.status(429).json({ error: 'AI APIのリクエスト制限に達しました。少し待ってから再試行してください。' });
    }
    return res.status(500).json({ error: '画像解析・登録に失敗しました', details: error?.message });
  }
});

export default router;
