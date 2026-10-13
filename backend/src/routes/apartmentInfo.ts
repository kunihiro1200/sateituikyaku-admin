/**
 * マンション外部建物情報 自動取得 API
 *
 * 物件住所・マンション名をもとに Jina AI Search で Web 検索し、
 * Claude API で建物情報を構造化して Supabase に保存する。
 *
 * エンドポイント:
 *   GET  /api/apartment-info/seller/:sellerNumber  - 保存済みデータを返す
 *   POST /api/apartment-info/seller/:sellerNumber/fetch  - Web 取得して保存
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────

interface ApartmentBuildingInfo {
  building_name: string | null;
  management_company: string | null;
  built_year_month: string | null;
  total_floors_above: number | null;
  total_floors_below: number | null;
  total_units: number | null;
  structure: string | null;
  developer_company: string | null;
  construction_company: string | null;
  management_type: string | null;
  has_elevator: string | null;
  large_repair_history: string | null;
  data_source: string | null;
}

// ──────────────────────────────────────────────
// 日本語物件住所からマンション名を抽出する
// 例: "福岡市博多区博多駅前2-1-1 ダイアパレス博多101" → "ダイアパレス博多"
// ──────────────────────────────────────────────

function extractBuildingNameFromAddress(address: string): string | null {
  if (!address) return null;

  // ① 号室・部屋番号を末尾から除去（例: 101号室, 1001, 20F）
  let cleaned = address
    .replace(/\s*\d{2,4}(号室?|F|階)?$/u, '')
    .trim();

  // ② 番地パターンの後ろにある文字列をマンション名と判断
  // パターン: 数字-数字(-数字)? の後に続くカタカナ・漢字・英字の文字列
  const patterns = [
    // 例: "1-2-3 マンション名" or "1-2-3マンション名"
    /\d+[-−ー]\d+(?:[-−ー]\d+)?\s*([^\d\s].{2,}?)$/u,
    // 例: "1番2号 マンション名"
    /\d+番\d+号\s*([^\d\s].{2,}?)$/u,
    // 例: "1丁目2-3 マンション名"
    /\d+丁目\d+[-−]?\d*\s*([^\d\s].{2,}?)$/u,
  ];

  for (const pattern of patterns) {
    const m = cleaned.match(pattern);
    if (m && m[1]) {
      const name = m[1].trim();
      // 3文字以上かつ数字だけでなければマンション名として採用
      if (name.length >= 3 && /[^\d]/.test(name)) {
        return name;
      }
    }
  }
  return null;
}

// ──────────────────────────────────────────────
// Jina AI Search でマンション建物情報を検索
// 無料: 200 リクエスト/日（API キー不要）
// JINA_API_KEY 環境変数があれば高レート制限が適用される
// ──────────────────────────────────────────────

async function searchBuildingInfo(
  propertyAddress: string,
  jinaApiKey?: string
): Promise<string> {
  // マンション名を住所から抽出して検索精度を上げる
  const buildingName = extractBuildingNameFromAddress(propertyAddress);
  console.log(`[apartmentInfo] extracted building name: "${buildingName}" from "${propertyAddress}"`);

  // 検索クエリ: マンション名があれば優先して使用（より精度が高い）
  const query = buildingName
    ? `"${buildingName}" マンション 管理会社 総戸数 築年月 施工会社 分譲会社 管理形態`
    : `${propertyAddress} マンション 管理会社 総戸数 築年月 施工会社 分譲会社 管理形態`;

  // ① まず Jina Search で Web 検索結果を取得
  try {
    const headers: Record<string, string> = {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
    };
    if (jinaApiKey) {
      headers['Authorization'] = `Bearer ${jinaApiKey}`;
    }

    const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
    console.log(`[apartmentInfo] Jina Search: ${searchUrl.substring(0, 120)}`);

    const searchRes = await axios.get(searchUrl, {
      headers,
      timeout: 30000,
    });

    const searchText: string =
      typeof searchRes.data === 'string'
        ? searchRes.data
        : JSON.stringify(searchRes.data);

    if (searchText && searchText.length > 200) {
      console.log(`[apartmentInfo] Jina Search returned ${searchText.length} chars`);

      // ② 検索結果に SUUMO やマンションノートの URL があれば詳細ページも取得
      const urlMatch = searchText.match(
        /https?:\/\/(suumo\.jp\/ms\/mansion|www\.mansion-note\.com\/mansion|www\.athome\.co\.jp\/)[^\s)"\]]+/
      );
      if (urlMatch) {
        const detailUrl = urlMatch[0];
        console.log(`[apartmentInfo] Jina Reader fetching detail: ${detailUrl}`);
        try {
          const detailHeaders: Record<string, string> = {
            Accept: 'text/plain',
            'X-Return-Format': 'markdown',
          };
          if (jinaApiKey) detailHeaders['Authorization'] = `Bearer ${jinaApiKey}`;

          const detailRes = await axios.get(
            `https://r.jina.ai/${detailUrl}`,
            { headers: detailHeaders, timeout: 20000 }
          );
          const detailText =
            typeof detailRes.data === 'string'
              ? detailRes.data
              : JSON.stringify(detailRes.data);

          if (detailText && detailText.length > 500) {
            // 検索結果 + 詳細ページを結合（Claude に渡す）
            return `## Web検索結果\n${searchText.substring(0, 3000)}\n\n## マンション詳細ページ（${detailUrl}）\n${detailText.substring(0, 5000)}`;
          }
        } catch {
          console.warn('[apartmentInfo] detail page fetch failed, using search results only');
        }
      }

      return searchText.substring(0, 6000);
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Jina Search error:', err?.message);
  }

  // ③ Jina Search が失敗した場合: r.jina.ai でマンションノート検索ページを直接取得
  try {
    const fallbackSearchUrl = `https://www.mansion-note.com/search/?q=${encodeURIComponent(propertyAddress)}`;
    const jinaReadUrl = `https://r.jina.ai/${fallbackSearchUrl}`;
    console.log(`[apartmentInfo] Fallback: r.jina.ai mansion-note search`);

    const headers: Record<string, string> = { Accept: 'text/plain' };
    if (jinaApiKey) headers['Authorization'] = `Bearer ${jinaApiKey}`;

    const res = await axios.get(jinaReadUrl, { headers, timeout: 20000 });
    const text =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    if (text && text.length > 200) {
      return text.substring(0, 6000);
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Fallback fetch error:', err?.message);
  }

  return '';
}

// ──────────────────────────────────────────────
// Claude API で Web テキストを構造化データに変換
// ──────────────────────────────────────────────

async function extractBuildingInfo(
  webContent: string,
  propertyAddress: string,
  apiKey: string
): Promise<ApartmentBuildingInfo & { data_source: string | null }> {
  const client = new Anthropic({ apiKey });

  const prompt = `以下はWeb検索結果です。物件住所「${propertyAddress}」のマンション建物情報を抽出してください。

## Web検索・ページ取得結果
${webContent}

## 抽出ルール
- 物件住所に最も合致するマンションの情報のみを抽出する
- 確実に確認できた情報のみ記載し、不確かな情報は null にする
- AIで推測・補完しない（外部データに記載がない項目は null）
- 数字は必ず数値型で返す（文字列にしない）
- 築年月が「1998年3月」形式の場合は「1998-03」に変換する
- 階数が「地上15階建」の場合は total_floors_above: 15 として返す
- 取得元URLはデータを参照したページのURL（https://... の形式）

## 出力形式（JSONのみ返してください。コードブロック不要）
{
  "building_name": "マンション名（例: ライオンズマンション大分）",
  "management_company": "管理会社名（例: 大和ライフネクスト）",
  "built_year_month": "築年月（YYYY-MM形式、例: 1998-03）",
  "total_floors_above": 地上階数（整数のみ、例: 15）,
  "total_floors_below": 地下階数（整数のみ、例: 1、なければ0）,
  "total_units": 総戸数（整数のみ、例: 120）,
  "structure": "建物構造（例: RC造・鉄筋コンクリート造、SRC造等）",
  "developer_company": "分譲会社名",
  "construction_company": "施工会社名",
  "management_type": "管理形態（例: 全部委託、一部委託、自主管理）",
  "has_elevator": "あり または なし（不明な場合は null）",
  "large_repair_history": "大規模修繕の実施年等（例: 2012年実施、なければ null）",
  "data_source": "情報取得ページのURL（https://...）"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  console.log('[apartmentInfo] Claude response:', responseText.substring(0, 400));

  // JSON 抽出
  const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
    responseText.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch
    ? jsonMatch[1] ?? jsonMatch[0]
    : responseText;

  try {
    const parsed = JSON.parse(jsonText);
    return {
      building_name: parsed.building_name ?? null,
      management_company: parsed.management_company ?? null,
      built_year_month: parsed.built_year_month ?? null,
      total_floors_above:
        typeof parsed.total_floors_above === 'number'
          ? parsed.total_floors_above
          : null,
      total_floors_below:
        typeof parsed.total_floors_below === 'number'
          ? parsed.total_floors_below
          : null,
      total_units:
        typeof parsed.total_units === 'number' ? parsed.total_units : null,
      structure: parsed.structure ?? null,
      developer_company: parsed.developer_company ?? null,
      construction_company: parsed.construction_company ?? null,
      management_type: parsed.management_type ?? null,
      has_elevator: parsed.has_elevator ?? null,
      large_repair_history: parsed.large_repair_history ?? null,
      data_source: parsed.data_source ?? null,
    };
  } catch {
    console.error('[apartmentInfo] Claude JSON parse failed:', jsonText.substring(0, 200));
    throw new Error('Claude の応答を JSON として解析できませんでした');
  }
}

// ──────────────────────────────────────────────
// GET /api/apartment-info/seller/:sellerNumber
// 保存済み建物情報を返す（なければ null）
// ──────────────────────────────────────────────

router.get('/seller/:sellerNumber', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data, error } = await supabase
      .from('seller_apartment_building_info')
      .select('*')
      .eq('seller_number', sellerNumber)
      .single();

    // PGRST116 = row not found（正常）
    if (error && error.code !== 'PGRST116') {
      console.error('[apartmentInfo/GET] supabase error:', error);
      return res.status(500).json({ error: '建物情報の読み込みに失敗しました' });
    }

    return res.json({ data: data ?? null });
  } catch (err: any) {
    console.error('[apartmentInfo/GET] error:', err?.message);
    return res.status(500).json({ error: '建物情報の読み込みに失敗しました' });
  }
});

// ──────────────────────────────────────────────
// POST /api/apartment-info/seller/:sellerNumber/fetch
// Web 検索（Jina AI）+ Claude 解析で建物情報を取得・保存
// ──────────────────────────────────────────────

router.post('/seller/:sellerNumber/fetch', async (req: Request, res: Response) => {
  const { sellerNumber } = req.params;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    // 1. sellers テーブルから物件住所を取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('property_address')
      .eq('seller_number', sellerNumber)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const propertyAddress: string = seller.property_address || '';
    if (!propertyAddress || propertyAddress.trim() === '' || propertyAddress === '未入力') {
      return res.status(422).json({
        error: '物件住所が未設定です。物件情報に住所を入力してから再試行してください。',
      });
    }

    console.log(`[apartmentInfo] fetching for ${sellerNumber}: ${propertyAddress}`);

    // 2. Jina AI Search でマンション情報を取得
    const jinaApiKey = process.env.JINA_API_KEY;
    const webContent = await searchBuildingInfo(propertyAddress, jinaApiKey);

    let buildingInfo: ApartmentBuildingInfo & { data_source: string | null };
    let fetchError: string | null = null;

    if (!webContent || webContent.trim().length < 100) {
      // Web 取得失敗：空データを保存してエラーを記録
      fetchError = 'Web 検索結果が取得できませんでした。住所が正確か確認してください。';
      buildingInfo = {
        building_name: null, management_company: null, built_year_month: null,
        total_floors_above: null, total_floors_below: null, total_units: null,
        structure: null, developer_company: null, construction_company: null,
        management_type: null, has_elevator: null, large_repair_history: null,
        data_source: null,
      };
    } else {
      // 3. Claude で構造化抽出
      try {
        buildingInfo = await extractBuildingInfo(webContent, propertyAddress, anthropicKey);
      } catch (claudeErr: any) {
        fetchError = claudeErr?.message || 'Claude による解析に失敗しました';
        buildingInfo = {
          building_name: null, management_company: null, built_year_month: null,
          total_floors_above: null, total_floors_below: null, total_units: null,
          structure: null, developer_company: null, construction_company: null,
          management_type: null, has_elevator: null, large_repair_history: null,
          data_source: null,
        };
      }
    }

    // 4. DB に upsert 保存
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from('seller_apartment_building_info')
      .upsert(
        {
          seller_number: sellerNumber,
          ...buildingInfo,
          fetched_at: now,
          fetch_error: fetchError,
          updated_at: now,
        },
        { onConflict: 'seller_number' }
      );

    if (upsertError) {
      console.error('[apartmentInfo/fetch] upsert error:', upsertError);
      return res.status(500).json({ error: '建物情報の保存に失敗しました' });
    }

    // 5. 保存したデータを返す
    const { data: saved } = await supabase
      .from('seller_apartment_building_info')
      .select('*')
      .eq('seller_number', sellerNumber)
      .single();

    return res.json({ data: saved, fetchError });
  } catch (err: any) {
    console.error('[apartmentInfo/fetch] error:', err?.message);
    return res.status(500).json({
      error: '建物情報の取得に失敗しました',
      details: err?.message,
    });
  }
});

export default router;
