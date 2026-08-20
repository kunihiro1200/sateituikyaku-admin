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

export interface MatchIntentInput {
  matchIntentType?: MatchIntentType;
  matchAreas?: string[];
  matchAreaFreeText?: string | null;
  matchTiming?: MatchTiming | null;
  matchPriceMin?: number | null;
  matchPriceMax?: number | null;
  matchMemo?: string | null;
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
  // マッチング判定の根拠（担当者に説明できるように明示する）
  matchReasons: string[];
  urgencyScore: number;
}

function normalizeAreaFreeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.trim().replace(/\s+/g, '');
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
  freeTextB: string | null
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
   * 売主のマッチング入力欄を更新する
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
   * 指定した売主に対して、マッチする買主候補を検索する
   */
  async findBuyerCandidatesForSeller(sellerId: string): Promise<{
    source: { id: string; number: string | null; name: string | null } | null;
    candidates: MatchCandidate[];
  }> {
    const { data: seller, error } = await this.supabase
      .from('sellers')
      .select('id, seller_number, name, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max')
      .eq('id', sellerId)
      .single();

    if (error || !seller) {
      throw new Error('売主が見つかりませんでした');
    }

    const sellerAreas: string[] = Array.isArray(seller.match_areas) ? seller.match_areas : [];
    const hasAnyCriteria = sellerAreas.length > 0 || !!seller.match_area_free_text;
    if (!hasAnyCriteria) {
      return {
        source: { id: seller.id, number: seller.seller_number, name: null },
        candidates: [],
      };
    }

    // buyersテーブルの match_areas は JSONB のためPostgRESTでの配列重なり検索は行わず、
    // 該当しそうな買主を取得したうえでJS側で判定する（既存のBuyerCandidateServiceと同じ方針）。
    const buyers = await this.fetchAllWithMatchIntent('buyers', 'buyer_number, name, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_memo, match_updated_at');

    const candidates: MatchCandidate[] = [];
    for (const buyer of buyers || []) {
      const buyerAreas: string[] = Array.isArray(buyer.match_areas) ? buyer.match_areas : [];
      if (buyerAreas.length === 0 && !buyer.match_area_free_text) continue;

      const areaResult = areasOverlap(sellerAreas, seller.match_area_free_text, buyerAreas, buyer.match_area_free_text);
      if (!areaResult.matched) continue;

      const priceResult = priceRangesOverlap(seller.match_price_min, seller.match_price_max, buyer.match_price_min, buyer.match_price_max);
      if (!priceResult.matched) continue;

      const timingResult = timingIsCompatible(seller.match_timing, buyer.match_timing);

      const reasons = [areaResult.reason, priceResult.reason, timingResult.reason].filter((r): r is string => !!r);

      candidates.push({
        type: 'buyer',
        id: buyer.buyer_number,
        number: buyer.buyer_number,
        name: buyer.name,
        matchAreas: buyerAreas,
        matchAreaFreeText: buyer.match_area_free_text,
        matchTiming: buyer.match_timing,
        matchPriceMin: buyer.match_price_min,
        matchPriceMax: buyer.match_price_max,
        matchMemo: buyer.match_memo,
        matchUpdatedAt: buyer.match_updated_at,
        matchReasons: reasons,
        urgencyScore: timingUrgencyScore(buyer.match_timing),
      });
    }

    candidates.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return {
      source: { id: seller.id, number: seller.seller_number, name: null },
      candidates,
    };
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
      .select('buyer_number, name, desired_area, desired_timing, price_range_house, price_range_apartment, price_range_land')
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

    const hasAnyCriteria = buyerAreas.length > 0;
    if (!hasAnyCriteria) {
      return {
        source: { id: buyer.buyer_number, number: buyer.buyer_number, name: buyer.name },
        candidates: [],
        missingRequiredFields: [],
      };
    }

    const sellers = await this.fetchAllWithMatchIntent('sellers', 'id, seller_number, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_memo, match_updated_at');

    const candidates: MatchCandidate[] = [];
    for (const seller of sellers || []) {
      const sellerAreas: string[] = Array.isArray(seller.match_areas) ? seller.match_areas : [];
      if (sellerAreas.length === 0 && !seller.match_area_free_text) continue;

      const areaResult = areasOverlap(buyerAreas, null, sellerAreas, seller.match_area_free_text);
      if (!areaResult.matched) continue;

      const priceResult = buyerPriceRanges.length === 0
        ? { matched: true, reason: null as string | null }
        : priceRangesOverlapAny(buyerPriceRanges, seller.match_price_min, seller.match_price_max);
      if (!priceResult.matched) continue;

      const timingResult = timingIsCompatible(buyer.desired_timing, seller.match_timing);
      const reasons = [areaResult.reason, priceResult.reason, timingResult.reason].filter((r): r is string => !!r);

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
      });
    }

    candidates.sort((a, b) => b.urgencyScore - a.urgencyScore);

    return {
      source: { id: buyer.buyer_number, number: buyer.buyer_number, name: buyer.name },
      candidates,
      missingRequiredFields: [],
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
