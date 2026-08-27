// マッチングサイドバー通知サービス
//
// 背景:
//   売主・買主のマッチング欄（MatchingIntentService）で入力された内容を使い、
//   「見逃し防止」のためサイドバーに常時カウントを表示する。
//   ボタンを押した時だけ検索するのではなく、対象データを保持している間は
//   自動的に候補の有無が可視化される。
//
// 判定ルール:
//   売主サイドバー: sellers.status が「追客中」「他決→追客」「除外後追客中」を含む売主のうち、
//                   マッチする買主が1件以上存在し、match_contact_status が
//                   '連絡済み'/'連絡不要' でないものをカウントする。
//                   seller_number が 'FI' 始まりなら福岡、それ以外は大分。
//   買主サイドバー: 買主ごとに、以下の両方を満たす売主が1件以上存在する場合にカウントする。
//                   1. property_listings.status に「非公開」を含まない物件を持つ
//                   2. その物件の property_number === sellers.seller_number の売主の
//                      status が「専任媒介」「一般媒介」「他決→専任」のいずれかを含む
//                   かつ買主の match_contact_status が '連絡済み'/'連絡不要' でない。
//
// 連絡状況（match_contact_status）が '連絡済み' または '連絡不要' の場合は
// サイドバーのカウント・一覧から除外されるが、レコード自体は残るため
// つうわモードページ・買主詳細ページの MatchingIntentPanel からいつでも確認できる。

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { areasOverlap, priceRangesOverlapAny, timingUrgencyScore, parseDesiredPriceRangeToMinMax, MATCH_TIMING_OPTIONS, MatchTiming, getTimingFreshness, propertyTypesOverlap, parsePropertyTypeCategories, PropertyTypeCategory } from './MatchingIntentService';
import { decrypt } from '../utils/encryption';

/**
 * seller_buyer_match_contacts と seller_seller_match_contacts テーブルから、
 * 「連絡未」でない（連絡済み/連絡不要になっている）ペアの組み合わせキー集合を取得する。
 * 
 * キー形式：
 * - 売主×買主: `${sellerId}:${buyerNumber}`
 * - 売主×売主: `${sellerId}:seller:${buyerSellerId}`
 */
async function fetchResolvedPairKeys(supabase: SupabaseClient): Promise<Set<string>> {
  const resolved = new Set<string>();
  const PAGE_SIZE = 1000;
  
  // 1. 売主×買主ペアの連絡状況
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('seller_buyer_match_contacts')
      .select('seller_id, buyer_number, contact_status')
      .neq('contact_status', '連絡未')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw new Error(`連絡状況の取得に失敗しました: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      resolved.add(`${row.seller_id}:${row.buyer_number}`);
    }
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  
  // 2. 売主×売主ペアの連絡状況（買い替え案件）
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('seller_seller_match_contacts')
      .select('seller_seller_id, buyer_seller_id, contact_status')
      .neq('contact_status', '連絡未')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      // テーブルが存在しない場合はスキップ
      console.warn('seller_seller_match_contacts テーブルが存在しないか、取得に失敗しました:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      // seller_seller_id = 売りたい売主のID
      // buyer_seller_id = 買いたい売主のID
      // キーは `${売りたい売主ID}:seller:${買いたい売主ID}` 形式
      resolved.add(`${row.seller_seller_id}:seller:${row.buyer_seller_id}`);
    }
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  
  return resolved;
}

const SELLER_ACTIVE_STATUSES = ['追客中', '他決→追客', '除外後追客中'];
const SELLER_LISTED_STATUSES = ['専任媒介', '一般媒介', '他決→専任'];

const isSellerActiveForFollowUp = (status: string | null | undefined): boolean => {
  const s = status || '';
  return SELLER_ACTIVE_STATUSES.some(st => s.includes(st));
};

const isSellerListed = (status: string | null | undefined): boolean => {
  const s = status || '';
  return SELLER_LISTED_STATUSES.some(st => s.includes(st));
};

const isFiSellerNumber = (sellerNumber: string | null | undefined): boolean => {
  return (sellerNumber || '').toString().startsWith('FI');
};

interface MatchIntentFields {
  match_areas: string[] | null;
  match_area_free_text: string | null;
  match_timing: string | null;
  match_price_min: number | null;
  match_price_max: number | null;
  match_updated_at: string | null;
  property_address?: string | null;
  property_type?: string | null;
}

/**
 * 買主の希望条件（desired_area / price_range_house,apartment,land / desired_timing）を
 * 売主の match_* フィールドと同じ形に変換した中間表現。
 */
interface BuyerDesiredConditions {
  buyer_number: string;
  name: string | null;
  match_contact_status: string | null;
  desiredAreas: string[];
  desiredAreaFreeText: string | null;
  priceRanges: Array<{ min: number; max: number }>;
  desiredTiming: string | null;
  receptionDate: string | null;
  inquiredPropertyAddress: string | null;
  propertyTypeCategories: Set<PropertyTypeCategory>;
}

const hasAnyMatchCriteria = (row: MatchIntentFields): boolean => {
  return !!row.property_address;
};

/**
 * 追客中売主 と 買主の希望条件 のマッチング判定（売主視点サイドバー用）。
 */
function matchesSellerToBuyer(seller: MatchIntentFields, buyer: BuyerDesiredConditions): boolean {
  const sellerAreas = Array.isArray(seller.match_areas) ? seller.match_areas : [];
  const areaResult = areasOverlap(sellerAreas, seller.match_area_free_text, buyer.desiredAreas, buyer.desiredAreaFreeText, seller.property_address, buyer.inquiredPropertyAddress);
  if (!areaResult.matched) return false;

  const typeResult = propertyTypesOverlap(parsePropertyTypeCategories(seller.property_type), buyer.propertyTypeCategories);
  if (!typeResult.matched) return false;

  if (buyer.priceRanges.length > 0) {
    const priceResult = priceRangesOverlapAny(buyer.priceRanges, seller.match_price_min, seller.match_price_max);
    if (!priceResult.matched) return false;
  }

  return true;
}

export interface SellerMatchSidebarItem {
  sellerId: string;
  sellerNumber: string | null;
  isFi: boolean;
  matchContactStatus: string | null;
  buyerMatchCount: number;
  topUrgencyScore: number;
  name: string | null;
  propertyAddress: string | null;
  propertyType: string | null;
}

export interface BuyerMatchSidebarItem {
  buyerNumber: string;
  name: string | null;
  matchContactStatus: string | null;
  sellerMatchCount: number;
  topUrgencyScore: number;
}

export class MatchingSidebarService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * 追客中の売主のうち、マッチする買主がいる件数をサイドバー用に集計する。
   * 福岡（FI）と大分（それ以外）を分けて返す。
   * 
   * 🔄 売主同士のマッチング（買い替え案件）も含める：
   * - 売主Aの「売りたい」× 買主の希望条件
   * - 売主Aの「売りたい」× 売主Bの「買いたい」 ← 追加
   */
  async getSellerSidebarCounts(): Promise<{ fukuoka: number; oita: number }> {
    const items = await this.getSellerMatchItems();
    const fukuoka = items.filter(i => i.isFi).length;
    const oita = items.filter(i => !i.isFi).length;
    return { fukuoka, oita };
  }

  /**
   * サイドバーの「マッチング」カテゴリをクリックしたときの一覧を返す（売主側）。
   */
  async getSellerMatchList(area: 'fukuoka' | 'oita'): Promise<SellerMatchSidebarItem[]> {
    const items = await this.getSellerMatchItems();
    return items.filter(i => (area === 'fukuoka' ? i.isFi : !i.isFi));
  }

  /**
   * 買主のうち、専任・一般媒介の売主で「非公開」でない物件を持つ売主にマッチする件数を集計する。
   */
  async getBuyerSidebarCount(): Promise<number> {
    const items = await this.getBuyerMatchItems();
    return items.length;
  }

  async getBuyerMatchList(): Promise<BuyerMatchSidebarItem[]> {
    return this.getBuyerMatchItems();
  }

  /**
   * 追客中売主 × 買主の希望条件 の総当たりマッチングを計算する（売主視点）。
   * 売主×買主ペア単位の連絡状況（seller_buyer_match_contacts）が
   * '連絡済み'/'連絡不要' になっているペアはカウント対象から除外する。
   * 
   * 🔄 売主同士のマッチング（買い替え案件）も含める：
   * - 売主Aの「売りたい」× 買主の希望条件
   * - 売主Aの「売りたい」× 売主Bの「買いたい」 ← 追加
   */
  private async getSellerMatchItems(): Promise<SellerMatchSidebarItem[]> {
    const sellers = await this.fetchActiveSellers();
    if (sellers.length === 0) return [];

    // 買主の希望条件を取得
    const buyers = await this.fetchBuyersWithDesiredConditions();
    
    // 🔄 売主の「買いたい」条件を取得（買い替え案件用）
    const sellerBuyIntents = await this.fetchSellerBuyIntents();
    
    const resolvedPairs = await fetchResolvedPairKeys(this.supabase);

    const items: SellerMatchSidebarItem[] = [];
    for (const seller of sellers) {
      if (!hasAnyMatchCriteria(seller)) continue;

      let buyerMatchCount = 0;
      let topUrgencyScore = 0;
      
      // 1. 買主の希望条件とのマッチング
      for (const buyer of buyers) {
        if (buyer.desiredAreas.length === 0 && !buyer.desiredAreaFreeText && !buyer.inquiredPropertyAddress) continue;
        if (!matchesSellerToBuyer(seller, buyer)) continue;
        // このペアが連絡済み/連絡不要になっている場合はカウントしない
        if (resolvedPairs.has(`${seller.id}:${buyer.buyer_number}`)) continue;
        // 買主の希望時期が陳腐化（基準期間の2倍経過）している場合はカウントしない
        if (getTimingFreshness(buyer.desiredTiming, buyer.receptionDate).freshness === 'expired') continue;
        buyerMatchCount++;
        const score = timingUrgencyScore(buyer.desiredTiming);
        if (score > topUrgencyScore) topUrgencyScore = score;
      }
      
      // 🔄 2. 売主の「買いたい」条件とのマッチング（買い替え案件）
      for (const buyIntent of sellerBuyIntents) {
        // 自分自身は除外
        if (buyIntent.sellerId === seller.id) continue;
        if (buyIntent.desiredAreas.length === 0 && !buyIntent.desiredAreaFreeText) continue;
        if (!matchesSellerToBuyer(seller, buyIntent)) continue;
        // このペアが連絡済み/連絡不要になっている場合はカウントしない
        // 🔄 売主同士のペアは `seller:${sellerId}` 形式でキーを作る
        if (resolvedPairs.has(`${seller.id}:seller:${buyIntent.sellerId}`)) continue;
        // 売主の希望時期が陳腐化（基準期間の2倍経過）している場合はカウントしない
        if (getTimingFreshness(buyIntent.desiredTiming, buyIntent.buyMatchUpdatedAt).freshness === 'expired') continue;
        buyerMatchCount++;
        const score = timingUrgencyScore(buyIntent.desiredTiming);
        if (score > topUrgencyScore) topUrgencyScore = score;
      }

      if (buyerMatchCount > 0) {
        let decryptedName: string | null = null;
        try { decryptedName = seller.name ? decrypt(seller.name) : null; } catch { decryptedName = null; }
        items.push({
          sellerId: seller.id,
          sellerNumber: seller.seller_number,
          isFi: isFiSellerNumber(seller.seller_number),
          matchContactStatus: seller.match_contact_status,
          buyerMatchCount,
          topUrgencyScore,
          name: decryptedName,
          propertyAddress: seller.property_address,
          propertyType: seller.property_type,
        });
      }
    }

    items.sort((a, b) => b.topUrgencyScore - a.topUrgencyScore);
    return items;
  }

  /**
   * 買主の希望条件 × (専任/一般媒介かつ非公開でない物件を持つ売主) の総当たりマッチングを計算する（買主視点）。
   * 売主×買主ペア単位の連絡状況（seller_buyer_match_contacts）が
   * '連絡済み'/'連絡不要' になっているペアはカウント対象から除外する。
   */
  private async getBuyerMatchItems(): Promise<BuyerMatchSidebarItem[]> {
    const buyers = await this.fetchBuyersWithDesiredConditions();
    if (buyers.length === 0) return [];

    const listedSellers = await this.fetchListedSellersWithVisibleProperty();
    if (listedSellers.length === 0) return [];

    const resolvedPairs = await fetchResolvedPairKeys(this.supabase);

    const items: BuyerMatchSidebarItem[] = [];
    for (const buyer of buyers) {
      if (buyer.desiredAreas.length === 0 && !buyer.desiredAreaFreeText && !buyer.inquiredPropertyAddress) continue;

      let sellerMatchCount = 0;
      let topUrgencyScore = 0;
      for (const seller of listedSellers) {
        if (!hasAnyMatchCriteria(seller)) continue;
        if (!matchesSellerToBuyer(seller, buyer)) continue;
        // このペアが連絡済み/連絡不要になっている場合はカウントしない
        if (resolvedPairs.has(`${seller.id}:${buyer.buyer_number}`)) continue;
        // 売主の時期が陳腐化（基準期間の2倍経過）している場合はカウントしない
        if (getTimingFreshness(seller.match_timing, seller.match_updated_at).freshness === 'expired') continue;
        sellerMatchCount++;
        const score = timingUrgencyScore(seller.match_timing);
        if (score > topUrgencyScore) topUrgencyScore = score;
      }

      if (sellerMatchCount > 0) {
        items.push({
          buyerNumber: buyer.buyer_number,
          name: buyer.name,
          matchContactStatus: buyer.match_contact_status,
          sellerMatchCount,
          topUrgencyScore,
        });
      }
    }

    items.sort((a, b) => b.topUrgencyScore - a.topUrgencyScore);
    return items;
  }

  /**
   * 追客中（追客中/他決→追客/除外後追客中）の売主をマッチング入力欄付きで取得する。
   */
  private async fetchActiveSellers(): Promise<Array<MatchIntentFields & {
    id: string; seller_number: string | null; status: string | null; match_contact_status: string | null;
    name: string | null; property_address: string | null; property_type: string | null;
  }>> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('id, seller_number, status, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_contact_status, name, property_address, property_type, match_updated_at')
        .is('deleted_at', null)
        .not('match_updated_at', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(`売主取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return results.filter(s => isSellerActiveForFollowUp(s.status));
  }

  /**
   * 専任/一般媒介 かつ「非公開」を含まない物件を持つ売主を取得する。
   * property_listings.property_number === sellers.seller_number でリンクする。
   */
  private async fetchListedSellersWithVisibleProperty(): Promise<Array<MatchIntentFields & {
    id: string; seller_number: string | null; match_timing: string | null;
  }>> {
    // 1. 専任/一般媒介の売主のうち、マッチング入力済みのものを取得
    const sellers: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('id, seller_number, status, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_updated_at')
        .is('deleted_at', null)
        .not('match_updated_at', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(`売主取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      sellers.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    const listedSellers = sellers.filter(s => isSellerListed(s.status) && s.seller_number);
    if (listedSellers.length === 0) return [];

    // 2. 該当する売主番号の物件を取得し、ステータスに「非公開」を含まないものだけ残す
    const sellerNumbers = listedSellers.map(s => s.seller_number);
    const visiblePropertyNumbers = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < sellerNumbers.length; i += CHUNK) {
      const chunk = sellerNumbers.slice(i, i + CHUNK);
      const { data, error } = await this.supabase
        .from('property_listings')
        .select('property_number, status')
        .in('property_number', chunk);

      if (error) throw new Error(`物件取得に失敗しました: ${error.message}`);
      for (const p of data || []) {
        if (!(p.status || '').includes('非公開')) {
          visiblePropertyNumbers.add(p.property_number);
        }
      }
    }

    return listedSellers.filter(s => visiblePropertyNumbers.has(s.seller_number));
  }

  /**
   * 買主が問い合わせてきた物件（buyer.property_number）の住所・種別を、
   * property_listings から一括取得する。複数物件がある場合は先頭の物件番号を代表とする。
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
   * 希望条件（desired_area / price_range_* / desired_timing）が入力済みの買主を取得し、
   * 売主の match_* フィールドと比較できる形式に変換する。
   * エリア・種別の判定には、買主が問い合わせてきた物件（property_number経由）の
   * 住所・種別も候補として使う（希望条件の入力が薄い場合の補完）。
   */
  private async fetchBuyersWithDesiredConditions(): Promise<BuyerDesiredConditions[]> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number, name, desired_area, desired_area_free_text, desired_timing, desired_property_type, price_range_house, price_range_apartment, price_range_land, match_contact_status, reception_date, property_number')
        .is('deleted_at', null)
        .not('desired_area', 'is', null)
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
          match_contact_status: b.match_contact_status,
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
      // エリアは既存コード選択・自由入力・問合せ物件の住所のいずれかがあればよい。
      .filter(b => (b.desiredAreas.length > 0 || !!b.desiredAreaFreeText || !!b.inquiredPropertyAddress) && !!b.desiredTiming && MATCH_TIMING_OPTIONS.includes(b.desiredTiming as MatchTiming));
  }
  
  /**
   * 🔄 売主の「買いたい」条件を取得する（買い替え案件用）
   * 
   * sellers.buy_match_* フィールドから、買主の希望条件と同じ形式に変換する。
   */
  private async fetchSellerBuyIntents(): Promise<Array<BuyerDesiredConditions & { sellerId: string; buyMatchUpdatedAt: string | null }>> {
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

      if (error) throw new Error(`売主の買いたい条件取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return results
      .map(s => {
        const desiredAreas = Array.isArray(s.buy_match_areas)
          ? s.buy_match_areas
          : (s.buy_match_areas ? String(s.buy_match_areas).split('|').map((v: string) => v.trim()).filter(Boolean) : []);
        
        const propertyTypeCategories = new Set<PropertyTypeCategory>(
          Array.isArray(s.buy_match_property_types)
            ? s.buy_match_property_types
            : []
        );
        
        // 価格帯を priceRanges 形式に変換
        const priceRanges: Array<{ min: number; max: number }> = [];
        if (s.buy_match_price_min !== null && s.buy_match_price_max !== null) {
          priceRanges.push({
            min: s.buy_match_price_min,
            max: s.buy_match_price_max,
          });
        }
        
        return {
          sellerId: s.id,
          buyer_number: `seller:${s.id}`, // 売主同士のペアを識別するための疑似買主番号
          name: s.name,
          match_contact_status: null, // 売主同士の連絡状況は別管理
          desiredAreas,
          desiredAreaFreeText: s.buy_match_area_free_text || null,
          priceRanges,
          desiredTiming: s.buy_match_timing || null,
          receptionDate: null, // 売主の場合は受付日ではなく buy_match_updated_at を使う
          inquiredPropertyAddress: null, // 売主の買いたいには問合せ物件はない
          propertyTypeCategories,
          buyMatchUpdatedAt: s.buy_match_updated_at || null,
        };
      })
      // 「売主をマッチング」ボタンを押した（= 希望時期を選択・保存した）売主のみを対象にする
      .filter(s => (s.desiredAreas.length > 0 || !!s.desiredAreaFreeText) && !!s.desiredTiming && MATCH_TIMING_OPTIONS.includes(s.desiredTiming as MatchTiming));
  }
}
