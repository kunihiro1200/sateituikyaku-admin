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
// ──────────────────────────────────────────────

async function searchBuildingInfo(
  propertyAddress: string,
  jinaApiKey?: string
): Promise<string> {
  const buildingName = extractBuildingNameFromAddress(propertyAddress);
  const searchTarget = buildingName || propertyAddress;
  console.log(`[apartmentInfo] search target: "${searchTarget}" (addr: "${propertyAddress}")`);

  const jinaHeaders: Record<string, string> = {
    Accept: 'text/plain',
    'X-Return-Format': 'markdown',
  };
  if (jinaApiKey) jinaHeaders['Authorization'] = `Bearer ${jinaApiKey}`;

  const fetchPage = async (url: string): Promise<string> => {
    const res = await axios.get(`https://r.jina.ai/${url}`, {
      headers: jinaHeaders,
      timeout: 25000,
    });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  };

  // ──────────────────────────────────────
  // 戦略1: Jina Search（スニペット + URL抽出）
  //   スニペットにすでに 総戸数・築年月・構造等が含まれることが多い
  // ──────────────────────────────────────
  try {
    const query = buildingName
      ? `"${buildingName}" マンション 建物情報 管理会社 総戸数 築年月`
      : `${propertyAddress} マンション 建物情報 管理会社 総戸数`;

    console.log(`[apartmentInfo] Strategy1: s.jina.ai query="${query}"`);
    const searchRes = await axios.get(
      `https://s.jina.ai/${encodeURIComponent(query)}`,
      { headers: jinaHeaders, timeout: 30000 }
    );
    const searchText = typeof searchRes.data === 'string'
      ? searchRes.data
      : JSON.stringify(searchRes.data);

    if (searchText && searchText.length > 300) {
      console.log(`[apartmentInfo] Jina Search: ${searchText.length} chars`);

      // SUUMO library / AtHome bldg-library / マンションノート / 三井住友ライブラリ の詳細URLを全件抽出
      const detailPattern = /https?:\/\/(?:suumo\.jp\/library\/[^\s)"\]\n<]+|www\.athome\.co\.jp\/bldg-library\/[^\s)"\]\n<]+|www\.mansion-note\.com\/mansion\/[^\s)"\]\n<]+|library\.smtrc\.jp\/mansion\/[^\s)"\]\n<]+)/g;
      const rawUrls = searchText.match(detailPattern) ?? [];
      const detailUrls = rawUrls
        .map(u => u.replace(/[\)\]"'>,]+$/, ''))
        .filter(u => !u.includes('?q=') && !u.includes('/search') && !u.includes('/list'));

      console.log(`[apartmentInfo] Found detail URLs: ${JSON.stringify(detailUrls)}`);

      // 最初に取得できた詳細ページを使う
      for (const url of detailUrls) {
        try {
          const detailText = await fetchPage(url);
          if (detailText && detailText.length > 400) {
            console.log(`[apartmentInfo] Got detail page: ${url} (${detailText.length} chars)`);
            return `DATA_SOURCE_URL: ${url}\n\n## 建物詳細ページ\n${detailText.substring(0, 6000)}\n\n## 検索スニペット\n${searchText.substring(0, 1500)}`;
          }
        } catch (e) {
          console.warn(`[apartmentInfo] detail fetch failed ${url}:`, (e as any)?.message);
        }
      }

      // 詳細ページが取れなくてもスニペットをClaudeに渡す（スニペットだけで抽出できる場合が多い）
      console.log('[apartmentInfo] No detail page, using search snippets only');
      return `DATA_SOURCE_URL: (Jina Web検索スニペット)\n\n${searchText.substring(0, 6000)}`;
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Strategy1 Jina Search error:', err?.message);
  }

  // ──────────────────────────────────────
  // 戦略2: DuckDuckGo HTML（JS不要・サーバーサイドレンダリング）
  // ──────────────────────────────────────
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${searchTarget}" マンション 建物情報 管理会社 総戸数`)}`;
    console.log(`[apartmentInfo] Strategy2: DuckDuckGo HTML`);
    const ddgText = await fetchPage(ddgUrl);

    if (ddgText && ddgText.length > 300) {
      const detailPattern = /https?:\/\/(?:suumo\.jp\/library\/[^\s)"\]\n<]+|www\.athome\.co\.jp\/bldg-library\/[^\s)"\]\n<]+|library\.smtrc\.jp\/mansion\/[^\s)"\]\n<]+)/g;
      const detailUrls = (ddgText.match(detailPattern) ?? []).map(u => u.replace(/[\)\]"'>,]+$/, ''));

      for (const url of detailUrls) {
        try {
          const detailText = await fetchPage(url);
          if (detailText && detailText.length > 400) {
            return `DATA_SOURCE_URL: ${url}\n\n## 建物詳細ページ\n${detailText.substring(0, 6000)}`;
          }
        } catch { /* continue */ }
      }

      return `DATA_SOURCE_URL: ${ddgUrl}\n\n## DuckDuckGo検索結果\n${ddgText.substring(0, 5000)}`;
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Strategy2 DuckDuckGo error:', err?.message);
  }

  // ──────────────────────────────────────
  // 戦略3: SUUMO ライブラリ直接検索
  // ──────────────────────────────────────
  try {
    const suumoUrl = `https://suumo.jp/library/?q=${encodeURIComponent(searchTarget)}`;
    console.log(`[apartmentInfo] Strategy3: SUUMO library direct`);
    const suumoText = await fetchPage(suumoUrl);

    if (suumoText && suumoText.length > 300) {
      const detailMatch = suumoText.match(/https?:\/\/suumo\.jp\/library\/tf_[^\s)"\]\n<]+/);
      if (detailMatch) {
        const url = detailMatch[0].replace(/[\)\]"'>,]+$/, '');
        const detailText = await fetchPage(url);
        if (detailText && detailText.length > 400) {
          return `DATA_SOURCE_URL: ${url}\n\n## SUUMO物件ライブラリ\n${detailText.substring(0, 6000)}`;
        }
      }
      return `DATA_SOURCE_URL: ${suumoUrl}\n\n## SUUMO検索\n${suumoText.substring(0, 5000)}`;
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Strategy3 SUUMO error:', err?.message);
  }

  // ──────────────────────────────────────
  // 戦略4: AtHome 建物ライブラリ直接検索
  // ──────────────────────────────────────
  try {
    const athomeUrl = `https://www.athome.co.jp/bldg-library/?q=${encodeURIComponent(searchTarget)}`;
    console.log(`[apartmentInfo] Strategy4: AtHome bldg-library direct`);
    const athomeText = await fetchPage(athomeUrl);

    if (athomeText && athomeText.length > 300) {
      const detailMatch = athomeText.match(/https?:\/\/www\.athome\.co\.jp\/bldg-library\/[^\s)"\]\n<]+\/\d+\//);
      if (detailMatch) {
        const url = detailMatch[0].replace(/[\)\]"'>,]+$/, '');
        const detailText = await fetchPage(url);
        if (detailText && detailText.length > 400) {
          return `DATA_SOURCE_URL: ${url}\n\n## AtHome建物ライブラリ\n${detailText.substring(0, 6000)}`;
        }
      }
      return `DATA_SOURCE_URL: ${athomeUrl}\n\n## AtHome検索\n${athomeText.substring(0, 5000)}`;
    }
  } catch (err: any) {
    console.warn('[apartmentInfo] Strategy4 AtHome error:', err?.message);
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

  const prompt = `以下はマンション建物情報のページテキストまたはWeb検索スニペットです。物件住所「${propertyAddress}」のマンション建物情報を抽出してください。

## ページテキスト・スニペット
${webContent}

## 抽出ルール
- 物件住所に最も合致するマンションの情報のみ抽出する
- 確実に確認できた情報のみ記載し、推測・補完はしない
- 数字は必ず数値型で返す
- 築年月は「2010年8月」「2010年8月中旬」→「2010-08」に変換する
- 「10階建」「地上10階」→ total_floors_above: 10
- スニペット形式（「管理会社. タッケン管理サービス.」「施工会社: 吉原建設」等）からも必ず抽出する
- data_source はテキスト冒頭の "DATA_SOURCE_URL: https://..." のURLを使用する

## 出力形式（JSONのみ・コードブロック不要）
{
  "building_name": "マンション名",
  "management_company": "管理会社名",
  "built_year_month": "YYYY-MM（例: 2010-08）",
  "total_floors_above": 地上階数（整数）,
  "total_floors_below": 地下階数（整数、なければ 0）,
  "total_units": 総戸数（整数）,
  "structure": "建物構造（例: RC造）",
  "developer_company": "分譲会社名（施主・デベロッパー）",
  "construction_company": "施工会社名",
  "management_type": "管理形態（例: 全部委託）",
  "has_elevator": "あり または なし（不明は null）",
  "large_repair_history": "大規模修繕情報（なければ null）",
  "data_source": "DATA_SOURCE_URL のURL"
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

    return res.json({ data: saved, fetchError, debug: webContent.substring(0, 300) });
  } catch (err: any) {
    console.error('[apartmentInfo/fetch] error:', err?.message);
    return res.status(500).json({
      error: '建物情報の取得に失敗しました',
      details: err?.message,
    });
  }
});

export default router;
