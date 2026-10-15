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

      // SUUMO library / AtHome bldg-library / マンションノート / 三井住友ライブラリ / rehouse の詳細URLを全件抽出
      const detailPattern = /https?:\/\/(?:suumo\.jp\/library\/[^\s)"\]\n<]+|www\.athome\.co\.jp\/bldg-library\/[^\s)"\]\n<]+|www\.mansion-note\.com\/mansion\/[^\s)"\]\n<]+|library\.smtrc\.jp\/mansion\/[^\s)"\]\n<]+|rehouse\.co\.jp\/mansionlibrary\/[^\s)"\]\n<]+)/g;
      const rawUrls = searchText.match(detailPattern) ?? [];
      const detailUrls = rawUrls
        .map(u => u.replace(/[\)\]"'>,]+$/, ''))
        .filter(u => !u.includes('?q=') && !u.includes('/search') && !u.includes('/list'));

      console.log(`[apartmentInfo] Found detail URLs: ${JSON.stringify(detailUrls)}`);

      // 複数の詳細ページを取得して内容を結合（AtHomeが空でも rehouse/SUUMO で補完）
      const detailContents: string[] = [];
      const usedUrls: string[] = [];
      for (const url of detailUrls.slice(0, 5)) {
        if (detailContents.length >= 3) break; // 最大3ページ
        try {
          const detailText = await fetchPage(url);
          if (detailText && detailText.length > 200) {
            console.log(`[apartmentInfo] Got detail page: ${url} (${detailText.length} chars)`);
            detailContents.push(`## 出典: ${url}\n${detailText.substring(0, 2500)}`);
            usedUrls.push(url);
          }
        } catch (e) {
          console.warn(`[apartmentInfo] detail fetch failed ${url}:`, (e as any)?.message);
        }
      }

      if (detailContents.length > 0) {
        return `DATA_SOURCE_URL: ${usedUrls[0]}\n\n${detailContents.join('\n\n---\n\n')}\n\n## 検索スニペット（補足）\n${searchText.substring(0, 1500)}`;
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
      // ① 直接URLパターンで抽出（rehouse 追加）
      const detailPattern = /https?:\/\/(?:suumo\.jp\/library\/[^\s)"\]\n<]+|www\.athome\.co\.jp\/bldg-library\/[^\s)"\]\n<]+|library\.smtrc\.jp\/mansion\/[^\s)"\]\n<]+|rehouse\.co\.jp\/mansionlibrary\/[^\s)"\]\n<]+)/g;
      let detailUrls = (ddgText.match(detailPattern) ?? []).map(u => u.replace(/[\)\]"'>,]+$/, ''));

      // ② DuckDuckGo は uddg= にURLをエンコードして埋め込む場合があるのでデコードも試みる
      const uddgMatches = [...ddgText.matchAll(/uddg=(https?[^&\s"'<\)]+)/g)];
      const uddgUrls = uddgMatches
        .map(m => { try { return decodeURIComponent(m[1]); } catch { return ''; } })
        .filter(u => /(?:suumo\.jp\/library|athome\.co\.jp\/bldg-library|library\.smtrc\.jp\/mansion|rehouse\.co\.jp\/mansionlibrary)/.test(u));
      detailUrls = [...new Set([...detailUrls, ...uddgUrls])];
      console.log(`[apartmentInfo] DuckDuckGo found URLs: ${JSON.stringify(detailUrls)}`);

      for (const url of detailUrls) {
        try {
          const detailText = await fetchPage(url);
          if (detailText && detailText.length > 400) {
            // 詳細ページ + 検索スニペットを両方渡す（どちらかに欠けてる情報を補完）
            return `DATA_SOURCE_URL: ${url}\n\n## 建物詳細ページ（${url}）\n${detailText.substring(0, 4000)}\n\n## 検索スニペット（補足）\n${ddgText.substring(0, 2000)}`;
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
// 管理会社専用フォールバック検索
// メイン抽出で management_company が null のとき呼ばれる
// ──────────────────────────────────────────────

async function fetchManagementCompanyFallback(
  buildingName: string,
  jinaApiKey: string | undefined,
  anthropicApiKey: string
): Promise<string | null> {
  if (!buildingName) return null;

  const jinaHeaders: Record<string, string> = {
    Accept: 'text/plain',
    'X-Return-Format': 'markdown',
  };
  if (jinaApiKey) jinaHeaders['Authorization'] = `Bearer ${jinaApiKey}`;

  const query = `"${buildingName}" 管理会社`;
  console.log(`[apartmentInfo] mgmt fallback search: "${query}"`);

  let searchText = '';
  try {
    // DuckDuckGo HTML（s.jina.ai より安定）で管理会社を検索
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${buildingName}" 管理会社`)}`;
    const res = await axios.get(`https://r.jina.ai/${ddgUrl}`, {
      headers: jinaHeaders,
      timeout: 25000,
    });
    searchText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (e: any) {
    // DuckDuckGo が失敗したら s.jina.ai にフォールバック
    try {
      const res = await axios.get(
        `https://s.jina.ai/${encodeURIComponent(`"${buildingName}" 管理会社`)}`,
        { headers: jinaHeaders, timeout: 25000 }
      );
      searchText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (e2: any) {
      console.warn('[apartmentInfo] mgmt fallback search error:', e2?.message);
      return null;
    }
  }

  if (!searchText || searchText.length < 100) return null;

  // Claude に管理会社だけ聞く（軽量プロンプト）
  const client = new Anthropic({ apiKey: anthropicApiKey });
  try {
    const res = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `以下はWeb検索結果です。「${buildingName}」の管理会社名だけをJSON形式で答えてください。
不明な場合は {"management_company": null} と返してください。

${searchText.substring(0, 3000)}

出力: {"management_company": "会社名 または null"}`,
      }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const mgmt = parsed.management_company ?? null;
      console.log(`[apartmentInfo] mgmt fallback result: "${mgmt}"`);
      return mgmt;
    }
  } catch (e: any) {
    console.warn('[apartmentInfo] mgmt fallback Claude error:', e?.message);
  }
  return null;
}

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
    // 1. sellers テーブルから物件住所を取得、さらに properties テーブルからイエウール用マンション名も取得
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id, property_address')
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

    // イエウール用マンション名（property_address_ieul_apartment）を補完ヒントに使う
    // FI売主など住所にマンション名が含まれないケースで精度向上
    let ieulApartmentName: string | null = null;
    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('property_address_ieul_apartment')
        .eq('seller_id', seller.id)
        .single();
      ieulApartmentName = prop?.property_address_ieul_apartment || null;
    } catch { /* サイレント */ }

    console.log(`[apartmentInfo] fetching for ${sellerNumber}: ${propertyAddress} (ieul: ${ieulApartmentName})`);

    // 2. Jina AI Search でマンション情報を取得
    // マンション名が住所から取れない場合は ieulApartmentName を優先使用
    const jinaApiKey = process.env.JINA_API_KEY;
    const effectiveAddress = ieulApartmentName
      ? `${propertyAddress} ${ieulApartmentName}`.trim()
      : propertyAddress;
    const webContent = await searchBuildingInfo(effectiveAddress, jinaApiKey);

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
        buildingInfo = await extractBuildingInfo(webContent, effectiveAddress, anthropicKey);

        // 管理会社が取れなかった場合、専用フォールバック検索を実行
        if (!buildingInfo.management_company) {
          const buildingName = extractBuildingNameFromAddress(effectiveAddress)
            || (ieulApartmentName ? ieulApartmentName : null);
          if (buildingName) {
            const jinaKey = process.env.JINA_API_KEY;
            const mgmt = await fetchManagementCompanyFallback(buildingName, jinaKey, anthropicKey);
            if (mgmt) {
              console.log(`[apartmentInfo] management_company補完: "${mgmt}"`);
              buildingInfo.management_company = mgmt;
            }
          }
        }
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

// ──────────────────────────────────────────────
// POST /api/apartment-info/seller/:sellerNumber/fetch-listings
// 同一マンションの現在の売り出し物件を SUUMO / AtHome から取得・保存
// ──────────────────────────────────────────────

router.post('/seller/:sellerNumber/fetch-listings', async (req: Request, res: Response) => {
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
    // 1. DB から建物名と物件住所を取得
    const [{ data: seller }, { data: buildingData }] = await Promise.all([
      supabase.from('sellers').select('property_address').eq('seller_number', sellerNumber).single(),
      supabase.from('seller_apartment_building_info').select('building_name').eq('seller_number', sellerNumber).single(),
    ]);

    if (!seller) {
      return res.status(404).json({ error: '売主が見つかりません' });
    }

    const propertyAddress: string = seller.property_address || '';
    const buildingName: string =
      buildingData?.building_name ||
      extractBuildingNameFromAddress(propertyAddress) ||
      '';

    if (!buildingName) {
      return res.status(422).json({
        error: 'マンション名が特定できません。先に建物情報を取得してください。',
      });
    }

    console.log(`[apartmentInfo/listings] searching: "${buildingName}"`);

    const jinaApiKey = process.env.JINA_API_KEY;
    const jinaHeaders: Record<string, string> = {
      Accept: 'text/plain',
      'X-Return-Format': 'markdown',
    };
    if (jinaApiKey) jinaHeaders['Authorization'] = `Bearer ${jinaApiKey}`;

    const fetchPage = async (url: string): Promise<string> => {
      const r = await axios.get(`https://r.jina.ai/${url}`, {
        headers: jinaHeaders,
        timeout: 25000,
      });
      return typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    };

    // 2. SUUMO 中古マンション検索 + AtHome 中古マンション検索 + DuckDuckGo を並列取得
    const suumoSearchUrl = `https://suumo.jp/ms/mansion/?q=${encodeURIComponent(buildingName)}`;
    const athomeSearchUrl = `https://www.athome.co.jp/mansion/chuko/list/?q=${encodeURIComponent(buildingName)}`;
    const ddgSearchUrl    = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${buildingName}" 中古マンション 売り出し 価格 専有面積 階`)}`;

    const [suumoText, athomeText, ddgText] = await Promise.allSettled([
      fetchPage(suumoSearchUrl),
      fetchPage(athomeSearchUrl),
      fetchPage(ddgSearchUrl),
    ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : '')));

    const combinedContent = [
      suumoText ? `## SUUMO中古マンション検索（${suumoSearchUrl}）\n${suumoText.substring(0, 3000)}` : '',
      athomeText ? `## AtHome中古マンション検索（${athomeSearchUrl}）\n${athomeText.substring(0, 3000)}` : '',
      ddgText    ? `## DuckDuckGo検索スニペット\n${ddgText.substring(0, 2000)}` : '',
    ].filter(Boolean).join('\n\n');

    if (!combinedContent || combinedContent.length < 200) {
      return res.status(422).json({ error: '売り出し情報を検索できませんでした' });
    }

    // 3. Claude で売り出し一覧を抽出
    const client = new Anthropic({ apiKey: anthropicKey });
    const prompt = `以下はSUUMOとAtHomeの「${buildingName}」の中古マンション検索結果です。
現在売り出し中の物件（同一マンション内）の一覧を抽出してください。

${combinedContent}

## 抽出ルール
- 「${buildingName}」と同じマンション内の物件のみ抽出する
- 確実に確認できた情報のみ記載する（推測しない）
- 価格は円単位の整数（例: 24800000）
- 専有面積は m² の数値（例: 65.5）
- 階数は整数（例: 3）
- URL は完全なhttps://...形式で記載
- 最大10件まで
- 売り出し物件が見つからない場合は空配列を返す

## 出力形式（JSONのみ・コードブロック不要）
[
  {
    "url": "https://suumo.jp/...",
    "floor": 3,
    "area_sqm": 65.5,
    "price_yen": 24800000,
    "price_label": "2,480万円",
    "room_type": "3LDK"
  }
]`;

    const claudeRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text.trim() : '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(422).json({ error: '売り出し情報の解析に失敗しました', raw: responseText.substring(0, 200) });
    }

    const listings = JSON.parse(jsonMatch[0]);

    // 4. DB に upsert（listings カラムを更新）
    const now = new Date().toISOString();
    await supabase
      .from('seller_apartment_building_info')
      .upsert(
        {
          seller_number: sellerNumber,
          listings,
          listings_fetched_at: now,
          updated_at: now,
        },
        { onConflict: 'seller_number' }
      );

    return res.json({ listings, count: listings.length, building_name: buildingName });
  } catch (err: any) {
    console.error('[apartmentInfo/fetch-listings] error:', err?.message);
    return res.status(500).json({ error: '売り出し情報の取得に失敗しました', details: err?.message });
  }
});

export default router;
