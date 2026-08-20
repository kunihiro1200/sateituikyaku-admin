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
import { areasOverlap, priceRangesOverlapAny, timingUrgencyScore, parseDesiredPriceRangeToMinMax } from './MatchingIntentService';

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

const isContactDone = (contactStatus: string | null | undefined): boolean => {
  return contactStatus === '連絡済み' || contactStatus === '連絡不要';
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
  priceRanges: Array<{ min: number; max: number }>;
  desiredTiming: string | null;
}

const hasAnyMatchCriteria = (row: MatchIntentFields): boolean => {
  const areas = Array.isArray(row.match_areas) ? row.match_areas : [];
  return areas.length > 0 || !!row.match_area_free_text;
};

/**
 * 追客中売主 と 買主の希望条件 のマッチング判定（売主視点サイドバー用）。
 */
function matchesSellerToBuyer(seller: MatchIntentFields, buyer: BuyerDesiredConditions): boolean {
  const sellerAreas = Array.isArray(seller.match_areas) ? seller.match_areas : [];
  const areaResult = areasOverlap(sellerAreas, seller.match_area_free_text, buyer.desiredAreas, null);
  if (!areaResult.matched) return false;

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
   */
  private async getSellerMatchItems(): Promise<SellerMatchSidebarItem[]> {
    const sellers = await this.fetchActiveSellers();
    if (sellers.length === 0) return [];

    const buyers = await this.fetchBuyersWithDesiredConditions();

    const items: SellerMatchSidebarItem[] = [];
    for (const seller of sellers) {
      if (isContactDone(seller.match_contact_status)) continue;
      if (!hasAnyMatchCriteria(seller)) continue;

      let buyerMatchCount = 0;
      let topUrgencyScore = 0;
      for (const buyer of buyers) {
        if (isContactDone(buyer.match_contact_status)) continue;
        if (buyer.desiredAreas.length === 0) continue;
        if (!matchesSellerToBuyer(seller, buyer)) continue;
        buyerMatchCount++;
        const score = timingUrgencyScore(buyer.desiredTiming);
        if (score > topUrgencyScore) topUrgencyScore = score;
      }

      if (buyerMatchCount > 0) {
        items.push({
          sellerId: seller.id,
          sellerNumber: seller.seller_number,
          isFi: isFiSellerNumber(seller.seller_number),
          matchContactStatus: seller.match_contact_status,
          buyerMatchCount,
          topUrgencyScore,
        });
      }
    }

    items.sort((a, b) => b.topUrgencyScore - a.topUrgencyScore);
    return items;
  }

  /**
   * 買主の希望条件 × (専任/一般媒介かつ非公開でない物件を持つ売主) の総当たりマッチングを計算する（買主視点）。
   */
  private async getBuyerMatchItems(): Promise<BuyerMatchSidebarItem[]> {
    const buyers = await this.fetchBuyersWithDesiredConditions();
    if (buyers.length === 0) return [];

    const listedSellers = await this.fetchListedSellersWithVisibleProperty();
    if (listedSellers.length === 0) return [];

    const items: BuyerMatchSidebarItem[] = [];
    for (const buyer of buyers) {
      if (isContactDone(buyer.match_contact_status)) continue;
      if (buyer.desiredAreas.length === 0) continue;

      let sellerMatchCount = 0;
      let topUrgencyScore = 0;
      for (const seller of listedSellers) {
        if (!hasAnyMatchCriteria(seller)) continue;
        if (!matchesSellerToBuyer(seller, buyer)) continue;
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
  }>> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('sellers')
        .select('id, seller_number, status, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max, match_contact_status')
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
        .select('id, seller_number, status, match_areas, match_area_free_text, match_timing, match_price_min, match_price_max')
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
   * 希望条件（desired_area / price_range_* / desired_timing）が入力済みの買主を取得し、
   * 売主の match_* フィールドと比較できる形式に変換する。
   */
  private async fetchBuyersWithDesiredConditions(): Promise<BuyerDesiredConditions[]> {
    const results: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('buyers')
        .select('buyer_number, name, desired_area, desired_timing, price_range_house, price_range_apartment, price_range_land, match_contact_status')
        .is('deleted_at', null)
        .not('desired_area', 'is', null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(`買主取得に失敗しました: ${error.message}`);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    return results
      .map(b => ({
        buyer_number: b.buyer_number,
        name: b.name,
        match_contact_status: b.match_contact_status,
        desiredAreas: b.desired_area
          ? String(b.desired_area).split('|').map((v: string) => v.trim()).filter(Boolean)
          : [],
        priceRanges: [
          parseDesiredPriceRangeToMinMax(b.price_range_house),
          parseDesiredPriceRangeToMinMax(b.price_range_apartment),
          parseDesiredPriceRangeToMinMax(b.price_range_land),
        ].filter((r): r is { min: number; max: number } => r !== null),
        desiredTiming: b.desired_timing || null,
      }))
      .filter(b => b.desiredAreas.length > 0);
  }
}
