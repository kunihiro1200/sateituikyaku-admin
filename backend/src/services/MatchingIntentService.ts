// 売主・買主マッチング機能サービス
//
// 背景:
//   売主・買主のコメント欄（自由記述）をAIで解析してマッチングに使うのではなく、
//   専用の構造化入力欄（種別/エリア/時期/金額）を売主・買主それぞれに設け、
//   その入力値だけを使って決定論的にクロスマッチングする。
//   AIでのフリーテキスト解析（TokiExtractServiceのsanitizeOwnerInfoのようなパターン）は
//   ここでは使わない。入力自体を構造化することで解析の精度問題を排除する方針。
//
// マッチング条件:
//   1. エリア: 双方の match_areas（既存エリアコード配列）が1つ以上重なる
//      または match_area_free_text 同士が部分一致する（例: 「舞鶴町」）
//   2. 金額帯: 双方の [match_price_min, match_price_max] 区間がオーバーラップする
//      （どちらかが未入力の場合はその軸では条件を満たすとみなす＝制約なしと同義）
//   3. 時期: 双方が「今すぐ」「3ヶ月以内」「半年以内」など動く見込みの時期を入力していれば対象。
//      「1年以上・様子見」同士は対象外にはしない（緊急度の判定はUI側で補助表示するのみ）。

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type MatchIntentType = 'sell' | 'buy' | 'both';
export type MatchTiming = '今すぐ' | '3ヶ月以内' | '半年以内' | '1年以内' | '1年以上・様子見';

export const MATCH_TIMING_OPTIONS: MatchTiming[] = ['今すぐ', '3ヶ月以内', '半年以内', '1年以内', '1年以上・様子見'];

// 物件種別の選択肢
export const PROPERTY_TYPE_OPTIONS = ['マンション', '戸建て', '土地', 'その他'] as const;
export type PropertyType = typeof PROPERTY_TYPE_OPTIONS[number];

// 時期を緊急度スコアに変換（大きいほど緊急）。ソート・表示用。
const TIMING_URGENCY_SCORE: Record<string, number> = {
  '今すぐ': 5,
  '3ヶ月以内': 4,
  '半年以内': 3,
  '1年以内': 2,
  '1年以上・様子見': 1,
};

export function timingUrgencyScore(timing: string | null | undefined): number {
  if (!timing) return 0;
  return TIMING_URGENCY_SCORE[timing] ?? 0;
}

// ============================================================
// 時期の陳腐化判定（fresh / warning / expired）
//
// 背景:
//   「半年以内」と入力してから何年も経過している場合、まだ動く意思があるか不明。
//   一方で、決まっていないだけで実際にはまだ有効なケースも多い。
//   そのため即除外はせず、基準期間の間は通常表示、基準期間〜2倍の間は
//   警告表示（テーブルには残す）、2倍を超えたら候補から除外する。
//
// 基準期間（入力してからの経過月数）:
//   今すぐ = 1ヶ月 / 3ヶ月以内 = 3ヶ月 / 半年以内 = 6ヶ月 / 1年以内 = 12ヶ月
//   1年以上・様子見 = 期限なし（常にfresh。そもそも「様子見」なので陳腐化の概念がない）
//
// 基準日:
//   売主側: match_updated_at（マッチング欄の最終保存日時）
//   買主側: reception_date（受付日）。desired_timing専用の更新日時カラムは持たないため、
//           受付日を代用する（希望条件を変更しても受付日は更新されないが、実用上十分）。
// ============================================================
export type TimingFreshness = 'fresh' | 'warning' | 'expired';

const TIMING_BASE_MONTHS: Record<string, number> = {
  '今すぐ': 1,
  '3ヶ月以内': 3,
  '半年以内': 6,
  '1年以内': 12,
  // '1年以上・様子見' は期限なし（下記関数で別扱い）
};

export interface TimingFreshnessResult {
  freshness: TimingFreshness;
  monthsElapsed: number | null;
}

export function getTimingFreshness(
  timing: string | null | undefined,
  referenceDate: string | null | undefined
): TimingFreshnessResult {
  if (!timing || !(timing in TIMING_BASE_MONTHS)) {
    // 「1年以上・様子見」または時期未入力は期限なし
    return { freshness: 'fresh', monthsElapsed: null };
  }
  if (!referenceDate) {
    // 基準日が不明な場合は判定できないため除外しない
    return { freshness: 'fresh', monthsElapsed: null };
  }
  const refDate = new Date(referenceDate);
  if (isNaN(refDate.getTime())) {
    return { freshness: 'fresh', monthsElapsed: null };
  }

  const baseMonths = TIMING_BASE_MONTHS[timing];
  const now = new Date();
  // 年月の差分をおおよその経過月数として使う（日単位の厳密さは求めない）
  let monthsElapsed = (now.getFullYear() - refDate.getFullYear()) * 12 + (now.getMonth() - refDate.getMonth());
  if (now.getDate() < refDate.getDate()) monthsElapsed -= 1;
  if (monthsElapsed < 0) monthsElapsed = 0;

  if (monthsElapsed >= baseMonths * 2) {
    return { freshness: 'expired', monthsElapsed };
  }
  if (monthsElapsed >= baseMonths) {
    return { freshness: 'warning', monthsElapsed };
  }
  return { freshness: 'fresh', monthsElapsed };
}

export function timingFreshnessWarningReason(timing: string, monthsElapsed: number | null): string {
  return `⚠️ 「${timing}」と入力してから${monthsElapsed ?? '?'}ヶ月経過（要確認）`;
}

export interface MatchIntentInput {
  matchIntentType?: MatchIntentType;
  matchAreas?: string[];
  matchAreaFreeText?: string | null;
  matchTiming?: MatchTiming | null;
  matchPriceMin?: number | null;
  matchPriceMax?: number | null;
  matchMemo?: string | null;
  matchPropertyTypes?: string[]; // 物件種別配列（["マンション","戸建て","土地"]等）
}

export interface MatchCandidate {
  // 相手側の識別子・基本情報
  type: 'seller' | 'buyer';
  id: string; // sellers.id (UUID) または buyers.buyer_number
  number: string | null; // seller_number または buyer_number
  name: string | null;
  matchAreas: string[];
  matchAreaFreeText: string | null;
  matchTiming: string | null;
  matchPriceMin: number | null;
  matchPriceMax: number | null;
  matchMemo: string | null;
  matchUpdatedAt: string | null;
  matchPropertyTypes: string[]; // 物件種別配列
  // マッチング判定の根拠（担当者に説明できるように明示する）
  matchReasons: string[];
  urgencyScore: number;
  // 売主×買主ペア単位の連絡状況（連絡済み/連絡不要/連絡未）
  contactStatus: string;
  // 時期の陳腐化判定（fresh=通常 / warning=要確認だが表示は継続 / expired=候補から除外済み・通常は返らない）
  timingFreshness: TimingFreshness;
}

export const CONTACT_STATUS_OPTIONS = ['連絡済み', '連絡不要', '連絡未'] as const;
export type ContactStatus = typeof CONTACT_STATUS_OPTIONS[number];

function normalizeAreaFreeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.trim().replace(/\s+/g, '');
}

/**
 * 住所から地名のみを抽出（建物名を除外）
 * 正規表現で「都道府県・市区町村・町名・丁目」までを抽出
 * 返り値: { prefecture: '福岡県', location: '福岡市中央区谷' }
 */
function extractLocationFromAddress(address: string): { prefecture: string; location: string } | null {
  if (!address || address.length < 3) return null;

  // 番地・号の後の建物名を除去
  // 例: 「福岡県福岡市中央区谷２丁目20-8サンブリック桜坂106」 → 「福岡県福岡市中央区谷２丁目」
  let extracted = address;
  
  // パターン1: 丁目まである場合
  const match1 = address.match(/^(.+?[都道府県市区町村][^0-9]+[0-9０-９]+丁目)/);
  if (match1) {
    extracted = match1[1];
  } else {
    // パターン2: 丁目がない場合は、番地の前まで
    const match2 = address.match(/^(.+?[都道府県市区町村][^0-9]+)/);
    if (match2) {
      extracted = match2[1];
    }
  }

  return parsePrefectureAndLocation(extracted);
}

/**
 * 抽出された地名を都道府県と地名に分離
 */
function parsePrefectureAndLocation(fullLocation: string): { prefecture: string; location: string } | null {
  const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];

  for (const pref of prefectures) {
    if (fullLocation.startsWith(pref)) {
      return {
        prefecture: pref,
        location: fullLocation.substring(pref.length),
      };
    }
  }

  // 都道府県が見つからない場合は空文字列
  return { prefecture: '', location: fullLocation };
}

/**
 * フォールバック：正規表現で地名を抽出（現在はこれがメイン処理）
 */
function fallbackExtractLocation(address: string): { prefecture: string; location: string } | null {
  return extractLocationFromAddress(address);
}

/**
 * エリアが一致するか判定する。
 * 1. 既存エリアコード配列（match_areas）が1つ以上重なる → 一致
 * 2. 自由入力地名同士が部分一致する（どちらかがどちらかを含む） → 一致
 */
export function areasOverlap(
  areasA: string[],
  freeTextA: string | null,
  areasB: string[],
  freeTextB: string | null,
  addressesA?: (string | null | undefined)[] | string | null,
  addressesB?: (string | null | undefined)[] | string | null
): { matched: boolean; reason: string | null } {
  const setB = new Set(areasB);
  const codeOverlap = areasA.filter(a => setB.has(a));
  if (codeOverlap.length > 0) {
    return { matched: true, reason: `エリア一致: ${codeOverlap.join(', ')}` };
  }

  const normA = normalizeAreaFreeText(freeTextA);
  const normB = normalizeAreaFreeText(freeTextB);
  if (normA && normB) {
    if (normA.includes(normB) || normB.includes(normA)) {
      return { matched: true, reason: `エリア一致（自由入力）: 「${freeTextA}」⇔「${freeTextB}」` };
    }
  }

  // 自由入力地名 vs 相手の物件住所（複数候補: 自分の物件住所・買主が問合せてきた物件の住所など）
  // （相手が既存エリアコードを選ばず、自分も自由入力していない場合、実際の物件住所と比較する）
  const listA = (Array.isArray(addressesA) ? addressesA : [addressesA]).filter((a): a is string => !!a);
  const listB = (Array.isArray(addressesB) ? addressesB : [addressesB]).filter((b): b is string => !!b);

  if (normA) {
    for (const addr of listB) {
      const normAddr = normalizeAreaFreeText(addr);
      if (normAddr && normAddr.includes(normA)) {
        return { matched: true, reason: `エリア一致（自由入力⇔物件住所）: 「${freeTextA}」⇔「${addr}」` };
      }
    }
  }
  if (normB) {
    for (const addr of listA) {
      const normAddr = normalizeAreaFreeText(addr);
      if (normAddr && normAddr.includes(normB)) {
        return { matched: true, reason: `エリア一致（自由入力⇔物件住所）: 「${freeTextB}」⇔「${addr}」` };
      }
    }
  }

  // 物件住所同士の部分一致チェック（売主の物件住所 vs 買主の問合せ物件住所）
  // 正規表現で地名を抽出してから共通部分をチェック
  // 都道府県が一致する場合のみマッチング
  for (const addrA of listA) {
    const locA = extractLocationFromAddress(addrA);
    if (!locA || locA.location.length < 2) continue;
    
    for (const addrB of listB) {
      const locB = extractLocationFromAddress(addrB);
      if (!locB || locB.location.length < 2) continue;
      
      // 都道府県が一致しない場合はスキップ
      if (locA.prefecture !== locB.prefecture) continue;
      
      const normLocA = normalizeAreaFreeText(locA.location);
      const normLocB = normalizeAreaFreeText(locB.location);
      if (!normLocA || !normLocB) continue;
      
      // 完全な部分一致
      if (normLocA.includes(normLocB) || normLocB.includes(normLocA)) {
        return { matched: true, reason: `エリア一致（地名一致）: 「${locA.prefecture}${locA.location}」⇔「${locB.prefecture}${locB.location}」` };
      }
      
      // 共通部分の抽出（最低2文字以上の共通部分があればマッチ）
      for (let len = Math.min(normLocA.length, normLocB.length); len >= 2; len--) {
        for (let i = 0; i <= normLocA.length - len; i++) {
          const subA = normLocA.substring(i, i + len);
          if (normLocB.includes(subA)) {
            return { matched: true, reason: `エリア一致（地名共通部分）: 「${locA.prefecture}${locA.location}」⇔「${locB.prefecture}${locB.location}」（共通: ${subA}）` };
          }
        }
      }
    }
  }

  return { matched: false, reason: null };
}

// ============================================================
// 種別（マンション/戸建/土地/収益物件/その他）の判定
//
// 背景:
//   売主の property_type、買主の desired_property_type、買主が実際に問い合わせてきた
//   物件（buyer.property_number → property_listings.property_type）は、
//   表記が「マ」「戸建て」「戸建、マンション、土地」のように揺れているため、
//   カテゴリに正規化した上で重なりを判定する。
//   どちらかの種別が空・「条件次第」等で判定できない場合は制約しないでスルーする
//   （金額帯と同じ「未入力なら制約しない」方針）。
// ============================================================
const PROPERTY_TYPE_CATEGORIES = ['マンション', '戸建', '土地', '収益物件', 'その他'] as const;
export type PropertyTypeCategory = typeof PROPERTY_TYPE_CATEGORIES[number];

export function parsePropertyTypeCategories(text: string | null | undefined): Set<PropertyTypeCategory> {
  const categories = new Set<PropertyTypeCategory>();
  if (!text) return categories;
  const trimmed = text.trim();
  if (!trimmed || trimmed === '条件次第' || trimmed === '指定なし') return categories;

  const tokens = trimmed.split(/[,、・]/).map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    if (token.includes('マンション') || token === 'マ') {
      categories.add('マンション');
    } else if (token.includes('戸建') || token === '戸') {
      categories.add('戸建');
    } else if (token.includes('土地') || token === '土' || token === '売地') {
      categories.add('土地');
    } else if (token.includes('収益') || token.includes('アパート') || token.includes('ビル') || token === '一棟') {
      categories.add('収益物件');
    } else if (token.includes('店舗') || token === 'その他') {
      categories.add('その他');
    }
  }
  return categories;
}

export function propertyTypesOverlap(
  categoriesA: Set<PropertyTypeCategory>,
  categoriesB: Set<PropertyTypeCategory>
): { matched: boolean; reason: string | null } {
  if (categoriesA.size === 0 || categoriesB.size === 0) {
    // どちらかが判定不能（未入力・「条件次第」等） → 種別では制約しない
    return { matched: true, reason: null };
  }
  const overlap = [...categoriesA].filter(c => categoriesB.has(c));
  if (overlap.length > 0) {
    return { matched: true, reason: `種別一致: ${overlap.join(', ')}` };
  }
  return { matched: false, reason: null };
}

/**
 * 金額帯がオーバーラップするか判定する。
 * どちらかの上限・下限が未入力の場合は、その軸に制約がないとみなして通す。
 */
export function priceRangesOverlap(
  minA: number | null | undefined,
  maxA: number | null | undefined,
  minB: number | null | undefined,
  maxB: number | null | undefined
): { matched: boolean; reason: string | null } {
  const hasA = minA != null || maxA != null;
  const hasB = minB != null || maxB != null;
  if (!hasA || !hasB) {
    // どちらかが金額未入力 → 金額条件では制約しない
    return { matched: true, reason: null };
  }

  const loA = minA ?? 0;
  const hiA = maxA ?? Number.MAX_SAFE_INTEGER;
  const loB = minB ?? 0;
  const hiB = maxB ?? Number.MAX_SAFE_INTEGER;

  const overlap = loA <= hiB && loB <= hiA;
  if (overlap) {
    return { matched: true, reason: '金額帯が重なっている' };
  }
  return { matched: false, reason: null };
}

/**
 * 物件種別がオーバーラップするか判定する。
 * どちらかが未選択の場合は、その軸に制約がないとみなして通す。
 */
export function propertyTypesOverlap(
  typesA: string[] | null | undefined,
  typesB: string[] | null | undefined
): { matched: boolean; reason: string | null } {
  const hasA = typesA && typesA.length > 0;
  const hasB = typesB && typesB.length > 0;
  
  if (!hasA || !hasB) {
    // どちらかが種別未選択 → 種別条件では制約しない
    return { matched: true, reason: null };
  }

  const setA = new Set(typesA);
  const setB = new Set(typesB);
  const overlap = [...setA].filter(t => setB.has(t));

  if (overlap.length > 0) {
    return { matched: true, reason: `種別一致: ${overlap.join(', ')}` };
  }
  return { matched: false, reason: null };
}

/**
 * 時期条件を満たすか判定する。
 * 現時点では「両者に何らかの時期入力があるか」を軽い参考条件として扱い、
 * 未入力の場合は制約しない（時期は緊急度のソート表示に使うのが主目的）。
 */
export function timingIsCompatible(
  timingA: string | null | undefined,
  timingB: string | null | undefined
): { matched: boolean; reason: string | null } {
  if (!timingA || !timingB) {
    return { matched: true, reason: null };
  }
  // 時期そのものはマッチング条件にはしない（両者の温度感が違っても機会として提示する）
  return { matched: true, reason: `時期: 相手「${timingA}」⇔自分「${timingB}」` };
}

export class MatchingIntentService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * 売主のマッチング入力欄（売却条件）を更新する
   */
  async updateSellerIntent(sellerId: string, input: MatchIntentInput): Promise<void> {
    const updates = this.buildUpdatePayload(input);
    const { error } = await this.supabase
      .from('sellers')
      .update(updates)
      .eq('id', sellerId);
    if (error) {
      throw new Error(`売主マッチング情報の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 売主の「買いたい」マッチング入力欄（購入条件）を更新する。
   * 売却条件（match_*）とは独立したカラム（buy_match_*）を使う。
   * 売主が買い替え等で同時に「買いたい」意図を持つケースに対応する。
   */
  async updateSellerBuyIntent(sellerId: string, input: MatchIntentInput): Promise<void> {
    const updates = this.buildBuyUpdatePayload(input);
    const { error } = await this.supabase
      .from('sellers')
      .update(updates)
      .eq('id', sellerId);
    if (error) {
      throw new Error(`売主の購入マッチング情報の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 買主のマッチング入力欄を更新する
   */
  async updateBuyerIntent(buyerNumber: string, input: MatchIntentInput): Promise<void> {
    const updates = this.buildUpdatePayload(input);
    const { error } = await this.supabase
      .from('buyers')
      .update(updates)
      .eq('buyer_number', buyerNumber);
    if (error) {
      throw new Error(`買主マッチング情報の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 売主のマッチング連絡状況（連絡済み/連絡不要/連絡未）のみを更新する
   */
  async updateSellerContactStatus(sellerId: string, matchContactStatus: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('sellers')
      .update({ match_contact_status: matchContactStatus })
      .eq('id', sellerId);
    if (error) {
      throw new Error(`売主連絡状況の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 買主のマッチング連絡状況（連絡済み/連絡不要/連絡未）のみを更新する
   */
  async updateBuyerContactStatus(buyerNumber: string, matchContactStatus: string | null): Promise<void> {
    const { error } = await this.supabase
      .from('buyers')
      .update({ match_contact_status: matchContactStatus })
      .eq('buyer_number', buyerNumber);
    if (error) {
      throw new Error(`買主連絡状況の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 売主×買主ペア単位の連絡状況を取得する（一括）。
   * 該当レコードが存在しない場合は '連絡未' とみなす。
   */
  async getPairContactStatuses(sellerId: string, buyerNumbers: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (buyerNumbers.length === 0) return result;

    const { data, error } = await this.supabase
      .from('seller_buyer_match_contacts')
      .select('buyer_number, contact_status')
      .eq('seller_id', sellerId)
      .in('buyer_number', buyerNumbers);

    if (error) {
      throw new Error(`連絡状況の取得に失敗しました: ${error.message}`);
    }
    for (const row of data || []) {
      result.set(row.buyer_number, row.contact_status);
    }
    return result;
  }

  /**
   * 指定した買主に対する、複数売主とのペア連絡状況を取得する（一括）。
   */
  async getPairContactStatusesForBuyer(buyerNumber: string, sellerIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (sellerIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('seller_buyer_match_contacts')
      .select('seller_id, contact_status')
      .eq('buyer_number', buyerNumber)
      .in('seller_id', sellerIds);

    if (error) {
      throw new Error(`連絡状況の取得に失敗しました: ${error.message}`);
    }
    for (const row of data || []) {
      result.set(row.seller_id, row.contact_status);
    }
    return result;
  }

  /**
   * 売主×買主ペアの連絡状況を更新する（upsert）。
   */
  async updatePairContactStatus(sellerId: string, buyerNumber: string, contactStatus: string): Promise<void> {
    if (!CONTACT_STATUS_OPTIONS.includes(contactStatus as ContactStatus)) {
      throw new Error('連絡状況の値が不正です');
    }
    const { error } = await this.supabase
      .from('seller_buyer_match_contacts')
      .upsert(
        { seller_id: sellerId, buyer_number: buyerNumber, contact_status: contactStatus, updated_at: new Date().toISOString() },
        { onConflict: 'seller_id,buyer_number' }
      );
    if (error) {
      throw new Error(`連絡状況の更新に失敗しました: ${error.message}`);
    }
  }

  /**
   * 「買いたい」売主×「売りたい」売主ペア単位の連絡状況を取得する（一括）。
   */
  async getSellerSellerPairContactStatuses(buyerSellerId: string, sellerSellerIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (sellerSellerIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('seller_seller_match_contacts')
      .select('seller_seller_id, contact_status')
      .eq('buyer_seller_id', buyerSellerId)
      .in('seller_seller_id', sellerSellerIds);

    if (error) {
      throw new Error(`連絡状況の取得に失敗しました: ${error.message}`);
    }
    for (const row of data || []) {
      result.set(row.seller_seller_id, row.contact_status);
    }
    return result;
  }

  /**
   * 「買いたい」売主×「売りたい」売主ペアの連絡状況を更新する（upsert）。
   */
  async updateSellerSellerPairContactStatus(buyerSellerId: string, sellerSellerId: string, contactStatus: string): Promise<void> {
    if (!CONTACT_STATUS_OPTIONS.includes(contactStatus as ContactStatus)) {
      throw new Error('連絡状況の値が不正です');
    }
    const { error } = await this.supabase
      .from('seller_seller_match_contacts')
      .upsert(
        { buyer_seller_id: buyerSellerId, seller_seller_id: sellerSellerId, contact_status: contactStatus, updated_at: new Date().toISOString() },
        { onConflict: 'buyer_seller_id,seller_seller_id' }
      );
    if (error) {
      throw new Error(`連絡状況の更新に失敗しました: ${error.message}`);
    }
  }

  private buildUpdatePayload(input: MatchIntentInput): Record<string, any> {
    const updates: Record<string, any> = {
      match_updated_at: new Date().toISOString(),
    };
    if (input.matchIntentType !== undefined) updates.match_intent_type = input.matchIntentType;
    if (input.matchAreas !== undefined) updates.match_areas = input.matchAreas;
    if (input.matchAreaFreeText !== undefined) updates.match_area_free_text = input.matchAreaFreeText;
    if (input.matchTiming !== undefined) updates.match_timing = input.matchTiming;
    if (input.matchPriceMin !== undefined) updates.match_price_min = input.matchPriceMin;
    if (input.matchPriceMax !== undefined) updates.match_price_max = input.matchPriceMax;
    if (input.matchMemo !== undefined) updates.match_memo = input.matchMemo;
    if (input.matchPropertyTypes !== undefined) updates.match_property_types = input.matchPropertyTypes;
    return updates;
  }

  private buildBuyUpdatePayload(input: MatchIntentInput): Record<string, any> {
    const updates: Record<string, any> = {
      buy_match_updated_at: new Date().toISOString(),
    };
    if (input.matchAreas !== undefined) updates.buy_match_areas = input.matchAreas;
    if (input.matchAreaFreeText !== undefined) updates.buy_match_area_free_text = input.matchAreaFreeText;
    if (input.matchTiming !== undefined) updates.buy_match_timing = input.matchTiming;
    if (input.matchPriceMin !== undefined) updates.buy_match_price_min = input.matchPriceMin;
    if (input.matchPriceMax !== undefined) updates.buy_match_price_max = input.matchPriceMax;
    if (input.matchMemo !== undefined) updates.buy_match_memo = input.matchMemo;
    if (input.matchPropertyTypes !== undefined) updates.buy_match_property_types = input.matchPropertyTypes;
    return updates;
  }

  /**
   * match_area_free_text が入力済み、または match_areas に何か入っている可能性のある
   * レコードをページングしながら取得する（DB全件スキャンを避けるための最小限の絞り込み）。
   * JSONB配列の「空でない」判定はPostgREST上で不安定なため、
   * match_area_free_text が非nullのレコードは確実に取得し、
   * match_areas を含む全レコードもあわせて取得してJS側で最終判定する。
   */
  private async fetchAllWithMatchIntent(table: 'sellers' | 'buyers', selectFields: string): Promise<any[]> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;

    while (true) {
      const { data, error } = await this.supabase
        .from(table)
        .select(selectFields)
        .is('deleted_at', null)
        .not('match_updated_at', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        throw new Error(`${table} のマッチング候補取得に失敗しました: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return results;
  }

  /**
   * 指定した売主に対して、マッチする買主候補を検索する。
   *
   * 買主側は希望条件ページの既存フィールド（desired_area / price_range_house,apartment,land /
   * desired_timing）を使う。買主専用の match_* フィールドは使わない（廃止済み）。
   * これにより、つうわモードページのマッチング結果と、サイドバーのカウント（MatchingSidebarService）が
   * 同じデータソースを参照し、結果が一致するようにする。
   */
  async findBuyerCandidatesForSeller(sellerId: string): Promise<{
    source: { id: string; number: string | null; name: string | null } | null;
    candidates: MatchCandidate[];
    debug?: any;
  }> {
    const debug: any = {};
    
    const { data: seller, error } = await this.supabase
      .from('sellers')
      .select('id, seller_number, name, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_property_types, property_address, property_type')
      .eq('id', sellerId)
      .single();

    if (error || !seller) {
      throw new Error('売主が見つかりませんでした');
    }

    debug.seller = {
      number: seller.seller_number,
      property_address: seller.property_address,
      property_type: seller.property_type,
    };

    const sellerAreas: string[] = Array.isArray(seller.match_areas) ? seller.match_areas : [];
    // 種別: match_property_typesを優先、なければproperty_typeから抽出
    const sellerPropertyTypes: string[] = Array.isArray(seller.match_property_types) && seller.match_property_types.length > 0
      ? seller.match_property_types
      : [];
    // エリアの構造化入力（既存コード・自由入力）が両方未入力でも、物件住所があれば
    // それを判定材料として使えるため、物件住所も有効な条件として扱う。
    const hasAnyCriteria = sellerAreas.length > 0 || !!seller.match_area_free_text || !!seller.property_address;
    if (!hasAnyCriteria) {
      return {
        source: { id: seller.id, number: seller.seller_number, name: null },
        candidates: [],
      };
    }

    const sellerPropertyTypeCategories = parsePropertyTypeCategories(seller.property_type);
    const buyers = await this.fetchAllBuyersWithDesiredConditions();
    const buyerSellers = await this.fetchAllSellersWithBuyIntent();

    const candidates: MatchCandidate[] = [];
    const debugFiltered: any[] = [];
    
    console.log(`[MatchingIntent] 売主${seller.seller_number} 買主候補数: ${buyers.length}, 買いたい売主候補数: ${buyerSellers.length}`);
    for (const buyer of buyers) {
      console.log(`[MatchingIntent] 買主${buyer.buyer_number} チェック開始`);
      
      if (buyer.desiredAreas.length === 0 && !buyer.desiredAreaFreeText && !buyer.inquiredPropertyAddress) {
        console.log(`[MatchingIntent] 買主${buyer.buyer_number} 除外: エリア条件なし`);
        debugFiltered.push({ buyer: buyer.buyer_number, reason: 'エリア条件なし' });
        continue;
      }

      const areaResult = areasOverlap(sellerAreas, seller.match_area_free_text, buyer.desiredAreas, buyer.desiredAreaFreeText, seller.property_address, buyer.inquiredPropertyAddress);
      if (!areaResult.matched) {
        console.log(`[MatchingIntent] 買主${buyer.buyer_number} 除外: エリア不一致`, { sellerAreas, buyerAreas: buyer.desiredAreas, sellerAddress: seller.property_address, buyerAddress: buyer.inquiredPropertyAddress });
        debugFiltered.push({ 
          buyer: buyer.buyer_number, 
          reason: 'エリア不一致',
          details: {
            sellerAreas,
            sellerAddress: seller.property_address,
            buyerAreas: buyer.desiredAreas,
            buyerAddress: buyer.inquiredPropertyAddress
          }
        });
        continue;
      }

      const typeResult = propertyTypesOverlap(sellerPropertyTypes, buyer.propertyTypeCategories);
      if (!typeResult.matched) {
        console.log(`[MatchingIntent] 買主${buyer.buyer_number} 除外: 種別不一致`, { sellerType: sellerPropertyTypes, buyerType: Array.from(buyer.propertyTypeCategories) });
        debugFiltered.push({ 
          buyer: buyer.buyer_number, 
          reason: '種別不一致',
          details: {
            sellerType: sellerPropertyTypes,
            buyerType: Array.from(buyer.propertyTypeCategories)
          }
        });
        continue;
      }

      const priceResult = buyer.priceRanges.length === 0
        ? { matched: true, reason: null as string | null }
        : priceRangesOverlapAny(buyer.priceRanges, seller.match_price_min, seller.match_price_max);
      if (!priceResult.matched) {
        console.log(`[MatchingIntent] 買主${buyer.buyer_number} 除外: 価格不一致`, { buyerRanges: buyer.priceRanges, sellerMin: seller.match_price_min, sellerMax: seller.match_price_max });
        debugFiltered.push({ 
          buyer: buyer.buyer_number, 
          reason: '価格不一致',
          details: {
            buyerRanges: buyer.priceRanges,
            sellerMin: seller.match_price_min,
            sellerMax: seller.match_price_max
          }
        });
        continue;
      }
      
      console.log(`[MatchingIntent] 買主${buyer.buyer_number} マッチ成功！`);

      // 買主の希望時期の陳腐化判定（受付日を基準日として使用）
      const freshnessResult = getTimingFreshness(buyer.desiredTiming, buyer.receptionDate);
      if (freshnessResult.freshness === 'expired') continue;

      const timingResult = timingIsCompatible(seller.match_timing, buyer.desiredTiming);
      const reasons = [areaResult.reason, typeResult.reason, priceResult.reason, timingResult.reason].filter((r): r is string => !!r);
      if (freshnessResult.freshness === 'warning' && buyer.desiredTiming) {
        reasons.push(timingFreshnessWarningReason(buyer.desiredTiming, freshnessResult.monthsElapsed));
      }

      candidates.push({
        type: 'buyer',
        id: buyer.buyer_number,
        number: buyer.buyer_number,
        name: buyer.name,
        matchAreas: buyer.desiredAreas,
        matchAreaFreeText: buyer.desiredAreaFreeText,
        matchTiming: buyer.desiredTiming,
        matchPriceMin: buyer.priceRanges[0]?.min ?? null,
        matchPriceMax: buyer.priceRanges[0]?.max ?? null,
        matchPropertyTypes: Array.from(buyer.propertyTypeCategories),
        matchMemo: null,
        matchUpdatedAt: null,
        matchReasons: reasons,
        urgencyScore: timingUrgencyScore(buyer.desiredTiming),
        contactStatus: '連絡未',
        timingFreshness: freshnessResult.freshness,
      });
    }

    // 売主×買主ペア単位の連絡状況を一括取得して各候補に反映する
    const contactStatusMap = await this.getPairContactStatuses(seller.id, candidates.map(c => c.number!));
    for (const c of candidates) {
      c.contactStatus = contactStatusMap.get(c.number!) ?? '連絡未';
    }

    candidates.sort((a, b) => b.urgencyScore - a.urgencyScore);

    debug.buyersCount = buyers.length;
    debug.candidatesCount = candidates.length;
    debug.filtered = debugFiltered;
    debug.buyerNumbers = buyers.map(b => b.buyer_number);

    return {
      source: { id: seller.id, number: seller.seller_number, name: null },
      candidates,
      debug,
    };
  }

  /**
   * 「買いたい」条件（buy_match_areas / buy_match_property_types等）が入力済みの売主を全件取得し、
   * 売主とのマッチング判定用の中間形式に変換する。
   * 売主が「この物件と買主をマッチング」を押した際に、買主候補として表示するために使用。
   */
  private async fetchAllSellersWithBuyIntent(): Promise<Array<{
    seller_id: string; seller_number: string; name: string | null; desiredAreas: string[]; desiredAreaFreeText: string | null;
    priceRanges: Array<{ min: number; max: number }>; desiredTiming: string | null; matchUpdatedAt: string | null;
    propertyTypeCategories: string[];
  }>> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('id, seller_number, name, buy_match_areas, buy_match_area_free_text, buy_match_timing, buy_match_property_types, buy_match_price_min, buy_match_price_max, buy_match_updated_at')
        .is('deleted_at', null)
        .not('buy_match_updated_at', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(`売主（買いたい）取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return results
      .map(s => ({
        seller_id: s.id,
        seller_number: s.seller_number,
        name: s.name,
        desiredAreas: Array.isArray(s.buy_match_areas) ? s.buy_match_areas : [],
        desiredAreaFreeText: s.buy_match_area_free_text || null,
        priceRanges: (s.buy_match_price_min != null || s.buy_match_price_max != null)
          ? [{ min: s.buy_match_price_min ?? 0, max: s.buy_match_price_max ?? Number.MAX_SAFE_INTEGER }]
          : [],
        desiredTiming: s.buy_match_timing || null,
        matchUpdatedAt: s.buy_match_updated_at || null,
        propertyTypeCategories: Array.isArray(s.buy_match_property_types) ? s.buy_match_property_types : [],
      }))
      // エリアまたは種別のいずれかが入力されていれば候補とする
      .filter(s => s.desiredAreas.length > 0 || !!s.desiredAreaFreeText);
  }

  /**
   * 買主が問い合わせてきた物件（buyer.property_number）の住所・種別を、
   * property_listings から一括取得する。複数物件がある場合は先頭の物件番号を使う
   * （買主リストの他機能と同じ「複数物件はカンマ区切りで先頭を代表とする」慣習に合わせる）。
   */
  private async fetchInquiredPropertyInfo(propertyNumbers: string[]): Promise<Map<string, { address: string | null; propertyType: string | null }>> {
    const result = new Map<string, { address: string | null; propertyType: string | null }>();
    const uniqueNumbers = [...new Set(propertyNumbers.filter(Boolean))];
    if (uniqueNumbers.length === 0) return result;

    const CHUNK = 200;
    for (let i = 0; i < uniqueNumbers.length; i += CHUNK) {
      const chunk = uniqueNumbers.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('property_listings')
        .select('property_number, property_type, address, display_address')
        .in('property_number', chunk);

      if (error) throw new Error(`問合せ物件の取得に失敗しました: ${error.message}`);
      for (const p of data || []) {
        result.set(p.property_number, {
          address: (p.property_type === 'マンション' ? (p.display_address || p.address) : p.address) || null,
          propertyType: p.property_type || null,
        });
      }
    }
    return result;
  }

  /**
   * 希望条件（desired_area / price_range_* / desired_timing）が入力済みの買主を全件取得し、
   * 売主とのマッチング判定用の中間形式に変換する。
   * MatchingSidebarService.fetchBuyersWithDesiredConditions と同じロジック。
   * エリア・種別の判定には、買主が問い合わせてきた物件（property_number経由）の
   * 住所・種別も候補として使う（希望条件の入力が薄い場合の補完）。
   */
  private async fetchAllBuyersWithDesiredConditions(): Promise<Array<{
    buyer_number: string; name: string | null; desiredAreas: string[]; desiredAreaFreeText: string | null;
    priceRanges: Array<{ min: number; max: number }>; desiredTiming: string | null; receptionDate: string | null;
    inquiredPropertyAddress: string | null; propertyTypeCategories: Set<PropertyTypeCategory>;
  }>> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number, name, desired_area, desired_area_free_text, desired_timing, desired_property_type, price_range_house, price_range_apartment, price_range_land, reception_date, property_number, match_updated_at')
        .is('deleted_at', null)
        .not('match_updated_at', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(`買主取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    const firstPropertyNumbers = results.map(b => (b.property_number ? String(b.property_number).split(',')[0].trim() : null)).filter((n): n is string => !!n);
    const inquiredPropertyMap = await this.fetchInquiredPropertyInfo(firstPropertyNumbers);

    return results
      .map(b => {
        const firstPropertyNumber = b.property_number ? String(b.property_number).split(',')[0].trim() : null;
        const inquiredInfo = firstPropertyNumber ? inquiredPropertyMap.get(firstPropertyNumber) : undefined;
        const propertyTypeCategories = new Set<PropertyTypeCategory>([
          ...parsePropertyTypeCategories(b.desired_property_type),
          ...parsePropertyTypeCategories(inquiredInfo?.propertyType || null),
        ]);
        return {
          buyer_number: b.buyer_number,
          name: b.name,
          desiredAreas: b.desired_area
            ? String(b.desired_area).split('|').map((v: string) => v.trim()).filter(Boolean)
            : [],
          desiredAreaFreeText: b.desired_area_free_text || null,
          priceRanges: [
            parseDesiredPriceRangeToMinMax(b.price_range_house),
            parseDesiredPriceRangeToMinMax(b.price_range_apartment),
            parseDesiredPriceRangeToMinMax(b.price_range_land),
          ].filter((r): r is { min: number; max: number } => r !== null),
          desiredTiming: b.desired_timing || null,
          receptionDate: b.reception_date || null,
          inquiredPropertyAddress: inquiredInfo?.address || null,
          propertyTypeCategories,
        };
      })
      // 希望条件ページの「売主をマッチング」ボタンを押した（= 希望時期を選択・保存した）買主のみを対象にする。
      // 希望時期が未入力・不正な値の買主は候補に出さない。
      // エリアは既存コード選択・自由入力・問合せ物件の住所のいずれかがあればよい。
      .filter(b => (b.desiredAreas.length > 0 || !!b.desiredAreaFreeText || !!b.inquiredPropertyAddress) && !!b.desiredTiming && MATCH_TIMING_OPTIONS.includes(b.desiredTiming as MatchTiming));
  }

  /**
   * 買主の「希望条件」（desired_area / price_range_house,apartment,land / desired_timing）を使って
   * マッチする売主候補を検索する。
   *
   * 買主側は希望条件ページに既存の構造化フィールドがあるため、
   * sellers 用に新設した match_areas 等とは異なり、買主専用の match_* フィールドは使わない。
   * 買主の希望条件を売主の match_* フィールドと同じ形式に変換して比較する。
   */
  async findSellerCandidatesForBuyerDesiredConditions(buyerNumber: string): Promise<{
    source: { id: string; number: string | null; name: string | null } | null;
    candidates: MatchCandidate[];
    missingRequiredFields: string[];
  }> {
    const { data: buyer, error } = await this.supabase
      .from('buyers')
      .select('buyer_number, name, desired_area, desired_area_free_text, desired_timing, desired_property_type, price_range_house, price_range_apartment, price_range_land, property_number')
      .eq('buyer_number', buyerNumber)
      .single();

    if (error || !buyer) {
      throw new Error('買主が見つかりませんでした');
    }

    const missingRequiredFields: string[] = [];
    if (!buyer.desired_timing || !MATCH_TIMING_OPTIONS.includes(buyer.desired_timing as MatchTiming)) {
      missingRequiredFields.push('desired_timing');
    }
    if (missingRequiredFields.length > 0) {
      return {
        source: { id: buyer.buyer_number, number: buyer.buyer_number, name: buyer.name },
        candidates: [],
        missingRequiredFields,
      };
    }

    const buyerAreas: string[] = buyer.desired_area
      ? String(buyer.desired_area).split('|').map((v: string) => v.trim()).filter(Boolean)
      : [];
    const buyerPriceRanges = [
      parseDesiredPriceRangeToMinMax(buyer.price_range_house),
      parseDesiredPriceRangeToMinMax(buyer.price_range_apartment),
      parseDesiredPriceRangeToMinMax(buyer.price_range_land),
    ].filter((r): r is { min: number; max: number } => r !== null);

    // 買主が問い合わせてきた物件（property_number）の住所・種別も候補として使う
    const firstPropertyNumber = buyer.property_number ? String(buyer.property_number).split(',')[0].trim() : null;
    const inquiredPropertyMap = firstPropertyNumber ? await this.fetchInquiredPropertyInfo([firstPropertyNumber]) : new Map();
    const inquiredInfo = firstPropertyNumber ? inquiredPropertyMap.get(firstPropertyNumber) : undefined;
    const buyerPropertyTypeCategories = new Set<PropertyTypeCategory>([
      ...parsePropertyTypeCategories(buyer.desired_property_type),
      ...parsePropertyTypeCategories(inquiredInfo?.propertyType || null),
    ]);

    const hasAnyCriteria = buyerAreas.length > 0 || !!buyer.desired_area_free_text || !!inquiredInfo?.address;
    if (!hasAnyCriteria) {
      return {
        source: { id: buyer.buyer_number, number: buyer.buyer_number, name: buyer.name },
        candidates: [],
        missingRequiredFields: [],
      };
    }

    const sellers = await this.fetchAllWithMatchIntent('sellers', 'id, seller_number, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_memo, match_updated_at, property_address, property_type');

    const candidates: MatchCandidate[] = [];
    for (const seller of sellers || []) {
      const sellerAreas: string[] = Array.isArray(seller.match_areas) ? seller.match_areas : [];
      if (sellerAreas.length === 0 && !seller.match_area_free_text) continue;

      const areaResult = await areasOverlap(buyerAreas, buyer.desired_area_free_text, sellerAreas, seller.match_area_free_text, inquiredInfo?.address || null, seller.property_address);
      if (!areaResult.matched) continue;

      const typeResult = propertyTypesOverlap(buyerPropertyTypeCategories, parsePropertyTypeCategories(seller.property_type));
      if (!typeResult.matched) continue;

      const priceResult = buyerPriceRanges.length === 0
        ? { matched: true, reason: null as string | null }
        : priceRangesOverlapAny(buyerPriceRanges, seller.match_price_min, seller.match_price_max);
      if (!priceResult.matched) continue;

      // 売主の時期の陳腐化判定（マッチング欄の最終保存日時 match_updated_at を基準日として使用）
      const freshnessResult = getTimingFreshness(seller.match_timing, seller.match_updated_at);
      if (freshnessResult.freshness === 'expired') continue;

      const timingResult = timingIsCompatible(buyer.desired_timing, seller.match_timing);
      const reasons = [areaResult.reason, typeResult.reason, priceResult.reason, timingResult.reason].filter((r): r is string => !!r);
      if (freshnessResult.freshness === 'warning' && seller.match_timing) {
        reasons.push(timingFreshnessWarningReason(seller.match_timing, freshnessResult.monthsElapsed));
      }

      candidates.push({
        type: 'seller',
        id: seller.id,
        number: seller.seller_number,
        name: null, // 売主名は暗号化されているため一覧では出さない（詳細ページで確認する運用）
        matchAreas: sellerAreas,
        matchAreaFreeText: seller.match_area_free_text,
        matchTiming: seller.match_timing,
        matchPriceMin: seller.match_price_min,
        matchPriceMax: seller.match_price_max,
        matchMemo: seller.match_memo,
        matchUpdatedAt: seller.match_updated_at,
        matchReasons: reasons,
        urgencyScore: timingUrgencyScore(seller.match_timing),
        contactStatus: '連絡未',
        timingFreshness: freshnessResult.freshness,
      });
    }

    // 買主×売主ペア単位の連絡状況を一括取得して各候補に反映する
    const contactStatusMap = await this.getPairContactStatusesForBuyer(buyer.buyer_number, candidates.map(c => c.id));
    for (const c of candidates) {
      c.contactStatus = contactStatusMap.get(c.id) ?? '連絡未';
    }

    candidates.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return {
      source: { id: buyer.buyer_number, number: buyer.buyer_number, name: buyer.name },
      candidates,
      missingRequiredFields: [],
    };
  }

  /**
   * 「買いたい」意図を持つ売主（buy_match_*入力済み）に対して、
   * マッチする「売りたい」売主候補（match_*入力済み・自分以外）を検索する。
   *
   * findSellerCandidatesForBuyerDesiredConditions と条件判定ロジックは同じだが、
   * 検索元が買主の希望条件ではなく、売主自身の購入条件（buy_match_*）になる点、
   * および「自分自身」を候補から除外する点が異なる。
   */
  async findSellerCandidatesForSellerBuyIntent(buyerSellerId: string): Promise<{
    source: { id: string; number: string | null; name: string | null } | null;
    candidates: MatchCandidate[];
  }> {
    const { data: buyerSeller, error } = await this.supabase
      .from('sellers')
      .select('id, seller_number, buy_match_areas, buy_match_area_free_text, buy_match_timing, buy_match_price_min, buy_match_price_max, buy_match_property_types, property_address')
      .eq('id', buyerSellerId)
      .single();

    if (error || !buyerSeller) {
      throw new Error('売主が見つかりませんでした');
    }

    const buyerAreas: string[] = Array.isArray(buyerSeller.buy_match_areas) ? buyerSeller.buy_match_areas : [];
    // 種別: buy_match_property_typesを使用
    const buyerPropertyTypes: string[] = Array.isArray(buyerSeller.buy_match_property_types) && buyerSeller.buy_match_property_types.length > 0
      ? buyerSeller.buy_match_property_types
      : [];
    // 注意: 「買いたい」条件のエリア判定には buyerSeller.property_address を使わない。
    // それは「現在売却中の物件の住所（＝今住んでいる場所）」であり、
    // 「次に買いたいエリア」とは意味が異なるため、購入希望エリアの構造化入力
    // （buy_match_areas / buy_match_area_free_text）のみを条件とする。
    const hasAnyCriteria = buyerAreas.length > 0 || !!buyerSeller.buy_match_area_free_text;
    if (!hasAnyCriteria) {
      return {
        source: { id: buyerSeller.id, number: buyerSeller.seller_number, name: null },
        candidates: [],
      };
    }

    const sellers = await this.fetchAllWithMatchIntent('sellers', 'id, seller_number, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_property_types, match_memo, match_updated_at, property_address, property_type');

    const candidates: MatchCandidate[] = [];
    for (const seller of sellers || []) {
      if (seller.id === buyerSeller.id) continue; // 自分自身は除外

      const sellerAreas: string[] = Array.isArray(seller.match_areas) ? seller.match_areas : [];
      if (sellerAreas.length === 0 && !seller.match_area_free_text) continue;

      // 種別: match_property_typesを優先、なければproperty_typeから抽出
      let sellerPropertyTypes: string[] = Array.isArray(seller.match_property_types) && seller.match_property_types.length > 0
        ? seller.match_property_types
        : [];
      
      // match_property_typesが空で、property_typeがある場合はそれを使用
      if (sellerPropertyTypes.length === 0 && seller.property_type) {
        const typeMap: Record<string, string> = {
          'マ': 'マンション',
          '戸': '戸建て',
          '土': '土地',
          '他': 'その他'
        };
        const mappedType = typeMap[seller.property_type];
        if (mappedType) {
          sellerPropertyTypes = [mappedType];
        }
      }

      // 注意: buyerSeller.property_address（現在売却中の物件＝今住んでいる場所）は
      // 「次に買いたいエリア」とは意味が異なるため addressesA には渡さない（null）。
      // seller.property_address（相手＝売りたい側の実際の物件住所）は判定材料として使う。
      const areaResult = areasOverlap(buyerAreas, buyerSeller.buy_match_area_free_text, sellerAreas, seller.match_area_free_text, null, seller.property_address);
      if (!areaResult.matched) continue;

      // 種別判定
      const typeResult = propertyTypesOverlap(buyerPropertyTypes, sellerPropertyTypes);
      if (!typeResult.matched) continue;

      const priceResult = priceRangesOverlap(buyerSeller.buy_match_price_min, buyerSeller.buy_match_price_max, seller.match_price_min, seller.match_price_max);
      if (!priceResult.matched) continue;

      // 売却側の時期の陳腐化判定（マッチング欄の最終保存日時 match_updated_at を基準日として使用）
      const freshnessResult = getTimingFreshness(seller.match_timing, seller.match_updated_at);
      if (freshnessResult.freshness === 'expired') continue;

      const timingResult = timingIsCompatible(buyerSeller.buy_match_timing, seller.match_timing);
      const reasons = [areaResult.reason, typeResult.reason, priceResult.reason, timingResult.reason].filter((r): r is string => !!r);
      if (freshnessResult.freshness === 'warning' && seller.match_timing) {
        reasons.push(timingFreshnessWarningReason(seller.match_timing, freshnessResult.monthsElapsed));
      }

      candidates.push({
        type: 'seller',
        id: seller.id,
        number: seller.seller_number,
        name: null, // 売主名は暗号化されているため一覧では出さない（詳細ページで確認する運用）
        matchAreas: sellerAreas,
        matchAreaFreeText: seller.match_area_free_text,
        matchTiming: seller.match_timing,
        matchPriceMin: seller.match_price_min,
        matchPriceMax: seller.match_price_max,
        matchPropertyTypes: sellerPropertyTypes,
        matchMemo: seller.match_memo,
        matchUpdatedAt: seller.match_updated_at,
        matchReasons: reasons,
        urgencyScore: timingUrgencyScore(seller.match_timing),
        contactStatus: '連絡未',
        timingFreshness: freshnessResult.freshness,
      });
    }

    // 売主(買いたい)×売主(売りたい)ペア単位の連絡状況を一括取得して各候補に反映する
    const contactStatusMap = await this.getSellerSellerPairContactStatuses(buyerSeller.id, candidates.map(c => c.id));
    for (const c of candidates) {
      c.contactStatus = contactStatusMap.get(c.id) ?? '連絡未';
    }

    candidates.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return {
      source: { id: buyerSeller.id, number: buyerSeller.seller_number, name: null },
      candidates,
    };
  }
}

/**
 * 買主の価格帯選択肢（PRICE_RANGE_DETACHED_OPTIONS等）を円単位の min/max に変換する。
 * 「指定なし」「ヒアリングできず」等は制約なしとして null を返す。
 * 例: "~1900万" → { min: 0, max: 19000000 }
 *     "1000万~2999万" → { min: 10000000, max: 29990000 }
 *     "2000万以上" → { min: 20000000, max: Number.MAX_SAFE_INTEGER }
 */
export function parseDesiredPriceRangeToMinMax(value: string | null | undefined): { min: number; max: number } | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '指定なし' || trimmed === 'ヒアリングできず') return null;

  const toYen = (manStr: string): number => parseInt(manStr, 10) * 10000;

  // "1000万~2999万" のような範囲形式
  const rangeMatch = trimmed.match(/^(\d+)万\s*[~〜\-]\s*(\d+)万$/);
  if (rangeMatch) {
    return { min: toYen(rangeMatch[1]), max: toYen(rangeMatch[2]) };
  }

  // "~1900万" のような上限のみ形式
  const upperOnlyMatch = trimmed.match(/^[~〜]\s*(\d+)万$/);
  if (upperOnlyMatch) {
    return { min: 0, max: toYen(upperOnlyMatch[1]) };
  }

  // "2000万以上" のような下限のみ形式
  const lowerOnlyMatch = trimmed.match(/^(\d+)万\s*以上$/);
  if (lowerOnlyMatch) {
    return { min: toYen(lowerOnlyMatch[1]), max: Number.MAX_SAFE_INTEGER };
  }

  return null;
}

/**
 * 買主の複数の価格帯（戸建/マンション/土地）のいずれかが、売主の金額帯とオーバーラップするか判定する（OR条件）。
 */
export function priceRangesOverlapAny(
  buyerRanges: Array<{ min: number; max: number }>,
  sellerMin: number | null | undefined,
  sellerMax: number | null | undefined
): { matched: boolean; reason: string | null } {
  for (const range of buyerRanges) {
    const result = priceRangesOverlap(range.min, range.max, sellerMin, sellerMax);
    if (result.matched) return result;
  }
  return { matched: false, reason: null };
}
