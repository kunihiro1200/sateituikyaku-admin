/**
 * 他社物件：画像からAIで物件情報を読み取り、property_listingsに登録するAPI
 * POST /api/ai/extract-and-register-property
 * POST /api/ai/extract-property-preview （登録前プレビュー用）
 */
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import supabase from '../config/supabase';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/** 当社情報（都道府県別） */
const OWN_COMPANY_INFO: Record<'福岡' | '大分', { company_name: string; lines: string[] }> = {
  福岡: {
    company_name:
      '株式会社くじら不動産　〒810-0073 福岡市中央区舞鶴3-1-10　TEL:092-401-5331　mail:tenant@ifoo-oita.com',
    lines: [
      '株式会社くじら不動産',
      '〒810-0073 福岡市中央区舞鶴3-1-10',
      'TEL:092-401-5331  mail:tenant@ifoo-oita.com',
    ],
  },
  大分: {
    company_name:
      '株式会社いふう　〒870-0021 大分市舞鶴町1-3-30　TEL:097-533-2022　mail:tenant@ifoo-oita.com',
    lines: [
      '株式会社いふう',
      '〒870-0021 大分市舞鶴町1-3-30',
      'TEL:097-533-2022  mail:tenant@ifoo-oita.com',
    ],
  },
};

/**
 * Claudeで画像内の会社情報エリアを検出し、sharpで白塗り→SVGテキストを合成して差し替えた画像を返す
 */
async function replaceCompanyInfoInImage(
  imageBase64: string,
  mediaType: string,
  prefecture: '福岡' | '大分'
): Promise<Buffer | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // PDFは差し替え不可
  if (mediaType === 'application/pdf') return null;

  const client = new Anthropic({ apiKey });

  // 1. 会社情報エリアを検出
  const detectPrompt = `この画像は不動産の物件概要書です。
画像の下部に記載されている「不動産会社の情報エリア」（会社名・住所・電話番号・メールアドレス・ロゴなどを含む領域）を検出してください。

以下のJSON形式で返してください：
{
  "found": true または false,
  "region": {
    "x": 画像幅に対する左端の割合（0〜1）,
    "y": 画像高さに対する上端の割合（0〜1）,
    "width": 画像幅に対する幅の割合（0〜1）,
    "height": 画像高さに対する高さの割合（0〜1）
  }
}

重要：物件情報（住所・価格・備考など）は含めない。発行会社のロゴ・会社名・住所・TEL・メールのエリアのみ。
JSONのみ返してください。`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as any, data: imageBase64 } },
          { type: 'text', text: detectPrompt },
        ],
      }],
    });

    const text = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('');
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;
    const result = JSON.parse(jsonText);

    if (!result.found || !result.region) {
      console.log('[Replace] 会社情報エリアが検出されませんでした');
      return null;
    }

    const region = result.region;
    console.log('[Replace] 検出エリア:', region);

    // 2. sharpで画像加工
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const metadata = await sharp(imgBuffer).metadata();
    const imgW = metadata.width!;
    const imgH = metadata.height!;

    const rx = Math.floor(region.x * imgW);
    const ry = Math.floor(region.y * imgH);
    const rw = Math.ceil(region.width * imgW);
    const rh = Math.ceil(region.height * imgH);

    // 白い矩形を作成
    const whiteRect = await sharp({
      create: { width: rw, height: rh, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer();

    // テキストSVGを作成
    const ownInfo = OWN_COMPANY_INFO[prefecture];
    const fontSize = Math.max(12, Math.floor(rh / 5));
    const lineHeight = fontSize * 1.5;
    const textLines = ownInfo.lines.map((line, i) =>
      `<text x="10" y="${fontSize + i * lineHeight}" font-size="${fontSize}" font-family="sans-serif" fill="black">${line}</text>`
    ).join('');
    const textSvg = Buffer.from(
      `<svg width="${rw}" height="${rh}"><rect width="100%" height="100%" fill="white"/>${textLines}</svg>`
    );

    // 合成: 元画像にSVGを重ねる
    const processed = await sharp(imgBuffer)
      .composite([
        { input: await sharp(textSvg).png().toBuffer(), left: rx, top: ry },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();

    return processed;
  } catch (err) {
    console.error('[Replace] 会社情報差し替えエラー:', err);
    return null;
  }
}

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

    // 今日の日付（公開日）
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const insertData: Record<string, any> = {
      property_number: propertyNumber,
      address: merged.address || null,
      property_type: merged.property_type || null,
      price: merged.price || null,
      sidebar_status: sidebarCategory,
      atbb_status: '他社物件',
      confirmation: '済',
      // 発行会社（他社）を特記に保存
      special_notes: merged.issuing_company || null,
      // 当社情報で取引業者を上書き
      company_name: ownCompany.company_name,
      // 公開日に今日の日付をセット
      distribution_date: today,
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

    console.log('[AI Register] insertData:', JSON.stringify(insertData, null, 2));

    const { data: inserted, error: insertError } = await supabase
      .from('property_listings')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[AI Register] Supabase insert error:', insertError);
      // カラムが存在しないエラーの場合、存在しないカラムを除いて再試行
      // ただし special_notes・company_name・distribution_date は必ず含める
      const minimalData: Record<string, any> = {
        property_number: propertyNumber,
        address: merged.address || null,
        property_type: merged.property_type || null,
        price: merged.price || null,
        sidebar_status: sidebarCategory,
        atbb_status: '他社物件',
        confirmation: '済',
        distribution_date: today,
      };
      // special_notes が原因でなければ含める
      if (!insertError.message?.includes('special_notes')) {
        minimalData['special_notes'] = merged.issuing_company || null;
      }
      // company_name が原因でなければ含める
      if (!insertError.message?.includes('company_name')) {
        minimalData['company_name'] = ownCompany.company_name;
      }

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

    // 6. 画像をStorageに保存＋会社情報を差し替え
    if (mediaType !== 'application/pdf') {
      try {
        // 元画像を保存
        const originalBuffer = Buffer.from(imageBase64, 'base64');
        await supabase.storage
          .from('tasha-property-images')
          .upload(`${propertyNumber}/original.jpg`, originalBuffer, { contentType: 'image/jpeg', upsert: true });

        // 会社情報を差し替えた画像を生成・保存
        const pref = (prefecture === '福岡' ? '福岡' : '大分') as '福岡' | '大分';
        const replaced = await replaceCompanyInfoInImage(imageBase64, mediaType, pref);
        if (replaced) {
          await supabase.storage
            .from('tasha-property-images')
            .upload(`${propertyNumber}/replaced.jpg`, replaced, { contentType: 'image/jpeg', upsert: true });
          console.log(`[AI Register] 会社情報差し替え画像を保存: ${propertyNumber}/replaced.jpg`);
        }
      } catch (imgErr) {
        console.warn('[AI Register] Storage保存失敗（登録自体は成功）:', imgErr);
      }
    }

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

/**
 * DELETE /api/ai/tasha-property/:propertyNumber
 * 他社物件（FT/OT番号）を削除する
 * ・property_listingsから削除
 * ・Storageの画像も削除
 */
router.delete('/tasha-property/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    // FT or OT 番号のみ削除可能（誤削除防止）
    if (!propertyNumber.startsWith('FT') && !propertyNumber.startsWith('OT')) {
      return res.status(400).json({ error: '他社物件（FT/OT番号）のみ削除できます' });
    }

    // Storageの画像を削除（存在しなくてもエラーにしない）
    const { data: storageFiles } = await supabase.storage
      .from('tasha-property-images')
      .list(propertyNumber);

    if (storageFiles && storageFiles.length > 0) {
      const paths = storageFiles.map((f: any) => `${propertyNumber}/${f.name}`);
      await supabase.storage.from('tasha-property-images').remove(paths);
      console.log(`[Tasha Delete] Storage削除: ${paths.join(', ')}`);
    }

    // property_listingsから削除
    const { error: deleteError } = await supabase
      .from('property_listings')
      .delete()
      .eq('property_number', propertyNumber);

    if (deleteError) {
      return res.status(500).json({ error: '削除に失敗しました', details: deleteError.message });
    }

    console.log(`[Tasha Delete] 他社物件削除成功: ${propertyNumber}`);
    return res.json({ success: true, propertyNumber });
  } catch (error: any) {
    console.error('[Tasha Delete] Error:', error);
    return res.status(500).json({ error: '削除に失敗しました', details: error?.message });
  }
});

/**
 * POST /api/ai/tasha-property-image/:propertyNumber
 * 他社物件の画像をSupabase Storageに保存する
 * body: { imageBase64: string, mediaType: string, fileName?: string }
 */
router.post('/tasha-property-image/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;
    const { imageBase64, mediaType, fileName } = req.body;

    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 と mediaType が必要です' });
    }

    // Base64をBufferに変換
    const buffer = Buffer.from(imageBase64, 'base64');

    // ファイル名決定（タイムスタンプ付き）
    const ext = mediaType === 'application/pdf' ? 'pdf'
      : mediaType === 'image/png' ? 'png'
      : mediaType === 'image/webp' ? 'webp'
      : 'jpg';
    const timestamp = Date.now();
    const storagePath = `${propertyNumber}/${fileName || `${timestamp}.${ext}`}`;

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from('tasha-property-images')
      .upload(storagePath, buffer, {
        contentType: mediaType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Tasha Image] Upload error:', uploadError);
      return res.status(500).json({ error: '画像保存に失敗しました', details: uploadError.message });
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('tasha-property-images')
      .getPublicUrl(storagePath);

    console.log(`[Tasha Image] 画像保存成功: ${storagePath}`);
    return res.json({ success: true, path: storagePath, url: urlData.publicUrl });
  } catch (error: any) {
    console.error('[Tasha Image] Error:', error);
    return res.status(500).json({ error: '画像保存に失敗しました', details: error?.message });
  }
});

/**
 * GET /api/ai/tasha-property-image/:propertyNumber
 * 他社物件の保存済み画像URL一覧を取得する
 */
router.get('/tasha-property-image/:propertyNumber', async (req: Request, res: Response) => {
  try {
    const { propertyNumber } = req.params;

    const { data: files, error } = await supabase.storage
      .from('tasha-property-images')
      .list(propertyNumber, { sortBy: { column: 'created_at', order: 'asc' } });

    if (error) {
      // バケットが存在しない・フォルダが空の場合は空配列を返す
      return res.json({ images: [] });
    }

    const images = (files || []).map((f: any) => {
      const path = `${propertyNumber}/${f.name}`;
      const { data: urlData } = supabase.storage
        .from('tasha-property-images')
        .getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
        size: f.metadata?.size,
        createdAt: f.created_at,
      };
    });

    return res.json({ images });
  } catch (error: any) {
    console.error('[Tasha Image List] Error:', error);
    return res.status(500).json({ error: '画像一覧取得に失敗しました', details: error?.message });
  }
});

/**
 * POST /api/ai/detect-company-region
 * 画像内の「会社情報エリア」の位置をClaudeで検出する
 * フロントエンドのCanvasで塗りつぶし→当社情報を上書きするために使用
 * body: { imageBase64, mediaType, prefecture }
 * returns: { region: { x, y, width, height, position } | null }
 *   - x,y,width,height は画像サイズに対する割合（0〜1）
 *   - position: 'bottom-left' | 'bottom-right' | 'bottom-center' など
 */
router.post('/detect-company-region', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mediaType, prefecture } = req.body;
    if (!imageBase64 || !mediaType) {
      return res.status(400).json({ error: 'imageBase64 と mediaType が必要です' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY が未設定です' });

    const client = new Anthropic({ apiKey });

    const isPdf = mediaType === 'application/pdf';

    const prompt = `この画像は不動産の物件概要書です。
画像の下部に記載されている「不動産会社の情報エリア」（会社名・住所・電話番号・メールアドレス・ロゴなどを含む領域）を検出してください。

以下のJSON形式で返してください：
{
  "found": true または false,
  "region": {
    "x": 画像幅に対する左端の割合（0〜1）,
    "y": 画像高さに対する上端の割合（0〜1）,
    "width": 画像幅に対する幅の割合（0〜1）,
    "height": 画像高さに対する高さの割合（0〜1）
  },
  "position": "bottom-left" または "bottom-right" または "bottom-full",
  "company_text": "検出した会社名・住所・電話番号のテキスト（確認用）"
}

重要なルール：
- 物件の住所・価格・備考などの「物件情報」は含めないこと
- 発行会社のロゴ・会社名・住所・TEL・メールが書かれたエリアのみ対象
- 見つからない場合は found: false を返す
- regionの値は必ず0〜1の範囲で返すこと
- 典型的には画像の左下または右下に位置する

JSONのみを返してください。`;

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          isPdf
            ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: imageBase64 } }
            : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as any, data: imageBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('');
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;
    const result = JSON.parse(jsonText);

    console.log('[Detect Company Region] result:', result);
    return res.json(result);
  } catch (error: any) {
    console.error('[Detect Company Region] Error:', error);
    return res.status(500).json({ error: '会社情報エリアの検出に失敗しました', details: error?.message });
  }
});

export default router;
