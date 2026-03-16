// 買主候補抽出サービス
import { createClient } from '@supabase/supabase-js';
import { BeppuAreaMappingService } from './BeppuAreaMappingService';
import { GeolocationService } from './GeolocationService';
import { getOitaCityAreas, getBeppuCityAreas } from '../utils/cityAreaMapping';

export interface BuyerCandidate {
  buyer_number: string;
  name: string | null;
  latest_status: string | null;
  desired_area: string | null;
  desired_property_type: string | null;
  reception_date: string | null;
  email: string | null;
  phone_number: string | null;
  inquiry_property_address: string | null;
  inquiry_property_price: number | null;
}

export interface BuyerCandidateResponse {
  candidates: BuyerCandidate[];
  total: number;
  property: {
    property_number: string;
    property_type: string | null;
    sales_price: number | null;
    distribution_areas: string | null;
    address: string | null;
  };
}

export class BuyerCandidateService {
  private supabase;
  private beppuAreaMappingService: BeppuAreaMappingService;
  private geolocationService: GeolocationService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.beppuAreaMappingService = new BeppuAreaMappingService();
    this.geolocationService = new GeolocationService();
  }

  /**
   * 物件に対する買主候補を取得
   */
  async getCandidatesForProperty(propertyNumber: string): Promise<BuyerCandidateResponse> {
    console.log(`[BuyerCandidateService] Searching for property: ${propertyNumber}`);

    // 物件情報を取得
    const { data: property, error: propertyError } = await this.supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();

    console.log(`[BuyerCandidateService] Property query result:`, { property, error: propertyError });

    if (propertyError || !property) {
      console.error(`[BuyerCandidateService] Property not found:`, propertyError);
      throw new Error('Property not found');
    }

    // 物件の住所からエリア番号をマッピング
    const propertyAreaNumbers = await this.getAreaNumbersForProperty(property);
    console.log(`[BuyerCandidateService] Property area numbers:`, propertyAreaNumbers);

    // 距離マッチングは現在無効化されているため座標取得をスキップ
    const propertyCoords = null;

    // 買主を全件取得（Supabaseの1000件制限を回避するためページネーション）
    const buyers: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('*')
        .is('deleted_at', null)  // 削除済みを除外
        .eq('distribution_type', '要')  // 配信種別が「要」のみ取得（DBレベルで絞り込み）
        .not('latest_status', 'like', '%買付%')  // 買付済みを除外
        .not('latest_status', 'like', '%D%')  // D確度を除外
        .order('reception_date', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (buyersError) {
        throw new Error(`Failed to fetch buyers: ${buyersError.message}`);
      }

      if (!data || data.length === 0) break;
      buyers.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }
    console.log(`[BuyerCandidateService] Total buyers fetched: ${buyers.length}`);

    // フィルタリング
    const candidates = await this.filterCandidates(
      buyers || [],
      property.property_type,
      property.sales_price,
      propertyAreaNumbers,
      propertyCoords
    );

    // 最大50件に制限
    const limitedCandidates = candidates.slice(0, 50);

    // 全買主の問い合わせ物件番号を収集
    const allPropertyNumbers = new Set<string>();
    limitedCandidates.forEach(b => {
      if (b.property_number) {
        const numbers = b.property_number.split(',').map((n: string) => n.trim()).filter((n: string) => n);
        numbers.forEach(n => allPropertyNumbers.add(n));
      }
    });

    // 一括で物件住所を取得
    const propertyAddressMap = await this.getPropertyAddressesInBatch(Array.from(allPropertyNumbers));

    // 各買主の問い合わせ物件住所を設定
    const candidatesWithAddress = limitedCandidates.map(b => {
      let inquiryPropertyAddress: string | null = null;
      let inquiryPropertyPrice: number | null = null;
      if (b.property_number) {
        const firstPropertyNumber = b.property_number.split(',')[0].trim();
        const info = propertyAddressMap.get(firstPropertyNumber);
        inquiryPropertyAddress = info?.address || null;
        inquiryPropertyPrice = info?.price ?? null;
      }

      return {
        buyer_number: b.buyer_number,
        name: b.name,
        latest_status: b.latest_status,
        desired_area: b.desired_area,
        desired_property_type: b.desired_property_type,
        reception_date: b.reception_date,
        email: b.email,
        phone_number: b.phone_number,
        inquiry_property_address: inquiryPropertyAddress,
        inquiry_property_price: inquiryPropertyPrice,
      };
    });

    return {
      candidates: candidatesWithAddress,
      total: limitedCandidates.length,
      property: {
        property_number: property.property_number,
        property_type: property.property_type,
        sales_price: property.sales_price,
        distribution_areas: propertyAreaNumbers.join(''),
        address: property.address,
      },
    };
  }

  /**
   * 複数の物件番号に対して住所と価格を一括取得
   */
  private async getPropertyAddressesInBatch(propertyNumbers: string[]): Promise<Map<string, { address: string; price: number | null }>> {
    const addressMap = new Map<string, { address: string; price: number | null }>();

    if (propertyNumbers.length === 0) {
      return addressMap;
    }

    try {
      const { data: properties, error } = await this.supabase
        .from('property_listings')
        .select('property_number, address, sales_price')
        .in('property_number', propertyNumbers);

      if (error) {
        console.error(`[BuyerCandidateService] Error getting property addresses in batch:`, error);
        return addressMap;
      }

      if (properties) {
        properties.forEach(p => {
          if (p.property_number && p.address) {
            addressMap.set(p.property_number, { address: p.address, price: p.sales_price ?? null });
          }
        });
      }

      return addressMap;
    } catch (error) {
      console.error(`[BuyerCandidateService] Error in getPropertyAddressesInBatch:`, error);
      return addressMap;
    }
  }

  /**
   * 買主候補をフィルタリング
   */
  private async filterCandidates(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<any[]> {
    // 同期フィルタを先に適用して件数を絞る（高速）
    const preFiltered = buyers.filter(buyer => {
      if (this.shouldExcludeBuyer(buyer)) return false;
      if (!this.matchesStatus(buyer)) return false;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) return false;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) return false;
      return true;
    });

    // エリアフィルタ（非同期）を Promise.all で並列実行
    const areaResults = await Promise.all(
      preFiltered.map(buyer =>
        this.matchesAreaCriteriaWithDistance(buyer, propertyAreaNumbers, propertyCoords)
      )
    );

    return preFiltered.filter((_, i) => areaResults[i]);
  }

  /**
   * 買主を除外すべきかどうかを判定
   * 以下のいずれかに該当する場合、除外する:
   * 1. 業者問合せである
   * 2. 希望エリアと希望種別が両方空欄である
   * 3. 配信種別が「要」でない
   */
  private shouldExcludeBuyer(buyer: any): boolean {
    // 1. 業者問合せは除外
    if (this.isBusinessInquiry(buyer)) {
      return true;
    }

    // 2. 希望エリアと希望種別が両方空欄の場合は除外
    if (!this.hasMinimumCriteria(buyer)) {
      return true;
    }

    // 3. 配信種別が「要」でない場合は除外
    if (!this.hasDistributionRequired(buyer)) {
      return true;
    }

    return false;
  }

  /**
   * 業者問合せかどうかを判定
   */
  private isBusinessInquiry(buyer: any): boolean {
    return this.isGyoshaInquiry(buyer);
  }

  /**
   * 最低限の希望条件を持っているかを判定
   */
  private hasMinimumCriteria(buyer: any): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    const desiredPropertyType = (buyer.desired_property_type || '').trim();
    return desiredArea !== '' || desiredPropertyType !== '';
  }

  /**
   * 配信種別が「要」かどうかを判定
   */
  private hasDistributionRequired(buyer: any): boolean {
    const distributionType = (buyer.distribution_type || '').trim();
    return distributionType === '要';
  }

  /**
   * 最新状況によるフィルタリング
   * - 「買付」または「D」を含む場合: 除外
   * - それ以外（A/B/C/不明/空欄など）: 対象
   */
  private matchesStatus(buyer: any): boolean {
    const latestStatus = (buyer.latest_status || '').trim();

    // 「買付」を含む場合は除外
    if (latestStatus.includes('買付')) {
      return false;
    }

    // 「D」を含む場合は除外
    if (latestStatus.includes('D')) {
      return false;
    }

    // それ以外は全て対象（空欄・不明・A/B/Cなど）
    return true;
  }

  /**
   * 業者問合せかどうかを判定
   */
  private isGyoshaInquiry(buyer: any): boolean {
    const inquirySource = (buyer.inquiry_source || '').trim();
    const distributionType = (buyer.distribution_type || '').trim();
    const brokerInquiry = (buyer.broker_inquiry || '').trim();

    if (inquirySource === '業者問合せ' || inquirySource.includes('業者')) {
      return true;
    }

    if (distributionType === '業者問合せ' || distributionType.includes('業者')) {
      return true;
    }

    if (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false' && brokerInquiry.toLowerCase() !== 'null') {
      return true;
    }

    return false;
  }

  /**
   * エリア条件によるフィルタリング（距離ベースも含む）
   * - 買主の希望エリアが空欄の場合: 条件を満たす
   * - 物件の配信エリアと買主の希望エリアが1つでも合致: 条件を満たす
   * - 買主が問い合わせた物件が近傍3km以内: 条件を満たす（一時的に無効化）
   */
  private async matchesAreaCriteriaWithDistance(
    buyer: any,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<boolean> {
    const desiredArea = (buyer.desired_area || '').trim();

    // 希望エリアが空欄の場合は条件を満たす
    if (!desiredArea) {
      return true;
    }

    // 1. エリア番号でのマッチング
    if (propertyAreaNumbers.length > 0) {
      const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);
      const areaMatch = propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
      if (areaMatch) {
        return true;
      }
    }

    // 2. 距離ベースのマッチング（一時的に無効化 - パフォーマンス問題のため）
    // if (propertyCoords) {
    //   const distanceMatch = await this.matchesByInquiryDistance(buyer, propertyCoords);
    //   if (distanceMatch) {
    //     return true;
    //   }
    // }

    return false;
  }

  /**
   * 買主が問い合わせた物件との距離でマッチング
   * 買主が以前に問い合わせた物件が近傍3km以内であれば条件を満たす
   */
  private async matchesByInquiryDistance(
    buyer: any,
    propertyCoords: { lat: number; lng: number }
  ): Promise<boolean> {
    try {
      const inquiryPropertyNumber = (buyer.property_number || '').trim();
      if (!inquiryPropertyNumber) {
        return false;
      }

      const firstPropertyNumber = inquiryPropertyNumber.split(',')[0].trim();
      if (!firstPropertyNumber) {
        return false;
      }

      const { data: inquiryProperty, error } = await this.supabase
        .from('property_listings')
        .select('google_map_url')
        .eq('property_number', firstPropertyNumber)
        .single();

      if (error || !inquiryProperty || !inquiryProperty.google_map_url) {
        return false;
      }

      const inquiryCoords = await this.geolocationService.extractCoordinatesFromUrl(
        inquiryProperty.google_map_url
      );

      if (!inquiryCoords) {
        return false;
      }

      const distance = this.geolocationService.calculateDistance(
        propertyCoords,
        inquiryCoords
      );

      console.log(`[BuyerCandidateService] Distance from inquiry property ${firstPropertyNumber}: ${distance.toFixed(2)}km`);

      // 3km以内であれば条件を満たす
      return distance <= 3.0;
    } catch (error) {
      console.error(`[BuyerCandidateService] Error in distance matching:`, error);
      return false;
    }
  }

  /**
   * 種別条件によるフィルタリング
   */
  private matchesPropertyTypeCriteria(buyer: any, propertyType: string | null): boolean {
    const desiredType = (buyer.desired_property_type || '').trim();

    if (desiredType === '指定なし') {
      return true;
    }

    if (!desiredType) {
      return false;
    }

    if (!propertyType) {
      return false;
    }

    const normalizedPropertyType = this.normalizePropertyType(propertyType);
    const normalizedDesiredTypes = desiredType.split(/[,、\s]+/).map((t: string) => this.normalizePropertyType(t));

    return normalizedDesiredTypes.some((dt: string) =>
      dt === normalizedPropertyType ||
      normalizedPropertyType.includes(dt) ||
      dt.includes(normalizedPropertyType)
    );
  }

  /**
   * 価格帯条件によるフィルタリング
   */
  private matchesPriceCriteria(
    buyer: any,
    salesPrice: number | null,
    propertyType: string | null
  ): boolean {
    if (!salesPrice) {
      return true;
    }

    let priceRange: string | null = null;
    const normalizedType = this.normalizePropertyType(propertyType || '');

    if (normalizedType === '戸建' || normalizedType.includes('戸建')) {
      priceRange = buyer.price_range_house;
    } else if (normalizedType === 'マンション' || normalizedType.includes('マンション')) {
      priceRange = buyer.price_range_apartment;
    } else if (normalizedType === '土地' || normalizedType.includes('土地')) {
      priceRange = buyer.price_range_land;
    }

    if (!priceRange || !priceRange.trim()) {
      return true;
    }

    const { min, max } = this.parsePriceRange(priceRange);
    return salesPrice >= min && salesPrice <= max;
  }

  /**
   * エリア番号を抽出（①②③...の形式）
   * 数字（例: 40）も丸数字（㊵）に変換してマッチングできるようにする
   */
  private extractAreaNumbers(areaString: string): string[] {
    const circledNumbers: string[] = areaString.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]/g) || [];

    // 数字を丸数字に変換（例: "40" → "㊵", "41" → "㊶"）
    const numberMatches = areaString.match(/\b(\d+)\b/g) || [];
    for (const numStr of numberMatches) {
      const num = parseInt(numStr, 10);
      const circled = this.numberToCircled(num);
      if (circled) {
        circledNumbers.push(circled);
      }
    }

    return [...new Set(circledNumbers)];
  }

  /**
   * 数字を丸数字に変換
   */
  private numberToCircled(num: number): string | null {
    if (num >= 1 && num <= 20) {
      return String.fromCharCode(0x2460 + num - 1); // ①〜⑳
    }
    if (num >= 21 && num <= 35) {
      return String.fromCharCode(0x3251 + num - 21); // ㉑〜㉟
    }
    if (num >= 36 && num <= 50) {
      return String.fromCharCode(0x32B1 + num - 36); // ㊱〜㊿
    }
    return null;
  }

  /**
   * 物件の住所からエリア番号を取得
   * 1. distribution_areasフィールドから丸数字を抽出
   * 2. 住所から詳細エリアマッピング（BeppuAreaMappingServiceのみ使用）
   * 3. 市区町のデフォルト（大分市⑤、別府市⑥）
   */
  /**
     * 物件の住所からエリア番号を取得
     * 1. distribution_areasフィールドから丸数字を抽出
     * 2. 住所から詳細エリアマッピング（cityAreaMapping使用）
     * 3. 市全体のデフォルト（大分市㊵、別府市㊶）
     */
    private async getAreaNumbersForProperty(property: any): Promise<string[]> {
      const areaNumbers = new Set<string>();

      // 1. distribution_areasフィールドから丸数字のみ抽出（数字→丸数字変換は行わない）
      const distributionAreas = property.distribution_areas || property.distribution_area || '';
      if (distributionAreas) {
        const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
        extracted.forEach((num: string) => areaNumbers.add(num));
      }

      // 2. 住所から詳細エリアマッピング
      const address = (property.address || '').trim();
      if (address) {
        // 大分市の場合: cityAreaMappingで詳細エリア番号を取得 + 市全体㊵
        if (address.includes('大分市')) {
          const oitaAreas = getOitaCityAreas(address);
          oitaAreas.forEach(num => areaNumbers.add(num));
          areaNumbers.add('㊵');
          console.log(`[BuyerCandidateService] Oita areas for ${address}:`, oitaAreas);
        }

        // 別府市の場合: cityAreaMappingで詳細エリア番号を取得 + 市全体㊶
        if (address.includes('別府市')) {
          const beppuAreas = getBeppuCityAreas(address);
          beppuAreas.forEach(num => areaNumbers.add(num));
          areaNumbers.add('㊶');
          console.log(`[BuyerCandidateService] Beppu areas for ${address}:`, beppuAreas);
        }
      }

      const result = Array.from(areaNumbers);
      console.log(`[BuyerCandidateService] Final area numbers for property:`, result);
      return result;
    }

  /**
   * 物件の座標を取得
   */
  private async getPropertyCoordinates(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      const googleMapUrl = property.google_map_url;
      if (!googleMapUrl) {
        return null;
      }

      const coords = await this.geolocationService.extractCoordinatesFromUrl(googleMapUrl);
      return coords;
    } catch (error) {
      console.error(`[BuyerCandidateService] Error extracting coordinates:`, error);
      return null;
    }
  }

  /**
   * 種別を正規化
   */
  private normalizePropertyType(type: string): string {
    const normalized = type.trim()
      .replace(/中古/g, '')
      .replace(/新築/g, '')
      .replace(/一戸建て/g, '戸建')
      .replace(/一戸建/g, '戸建')
      .replace(/戸建て/g, '戸建')
      .replace(/分譲/g, '')
      .trim();
    return normalized;
  }

  /**
   * 価格帯をパース（例: "1000万円〜2000万円" → { min: 10000000, max: 20000000 }）
   */
  private parsePriceRange(priceRange: string): { min: number; max: number } {
    let min = 0;
    let max = Number.MAX_SAFE_INTEGER;

    const cleanedRange = priceRange
      .replace(/,/g, '')
      .replace(/円/g, '')
      .replace(/万/g, '0000')
      .replace(/億/g, '00000000')
      .trim();

    const rangeMatch = cleanedRange.match(/(\d+)?\s*[〜～\-]\s*(\d+)?/);
    if (rangeMatch) {
      if (rangeMatch[1]) {
        min = parseInt(rangeMatch[1], 10);
      }
      if (rangeMatch[2]) {
        max = parseInt(rangeMatch[2], 10);
      }
      return { min, max };
    }

    const aboveMatch = cleanedRange.match(/(\d+)\s*以上/);
    if (aboveMatch) {
      min = parseInt(aboveMatch[1], 10);
      return { min, max };
    }

    const belowMatch = cleanedRange.match(/(\d+)\s*以下/);
    if (belowMatch) {
      max = parseInt(belowMatch[1], 10);
      return { min, max };
    }

    const singleMatch = cleanedRange.match(/^(\d+)$/);
    if (singleMatch) {
      const value = parseInt(singleMatch[1], 10);
      min = value * 0.8;
      max = value * 1.2;
      return { min, max };
    }

    return { min, max };
  }
}
