// 買主候補抽出サービス
import { createClient } from '@supabase/supabase-js';
import { BeppuAreaMappingService } from './BeppuAreaMappingService';
import { GeolocationService } from './GeolocationService';
import { GeocodingService } from './GeocodingService';
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
  private geocodingService: GeocodingService;
  private geocodingCache: Map<string, { lat: number; lng: number } | null>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.beppuAreaMappingService = new BeppuAreaMappingService();
    this.geolocationService = new GeolocationService();
    this.geocodingService = new GeocodingService();
    this.geocodingCache = new Map();
  }

  /**
   * 物件に対する買主候補を取得
   */
  async getCandidatesForProperty(propertyNumber: string): Promise<BuyerCandidateResponse> {
    console.log(`[BuyerCandidateService] Searching for property: ${propertyNumber}`);
    const startTime = Date.now();

    // 物件情報を取得
    const propertyStartTime = Date.now();
    const { data: property, error: propertyError } = await this.supabase
      .from('property_listings')
      .select('*')
      .eq('property_number', propertyNumber)
      .single();
    console.log(`[BuyerCandidateService] Property query time: ${Date.now() - propertyStartTime}ms`);

    console.log(`[BuyerCandidateService] Property query result:`, { property, error: propertyError });

    if (propertyError || !property) {
      console.error(`[BuyerCandidateService] Property not found:`, propertyError);
      throw new Error('Property not found');
    }

    // 物件の住所からエリア番号をマッピング
    const areaStartTime = Date.now();
    const propertyAreaNumbers = await this.getAreaNumbersForProperty(property);
    console.log(`[BuyerCandidateService] Area mapping time: ${Date.now() - areaStartTime}ms`);
    console.log(`[BuyerCandidateService] Property area numbers:`, propertyAreaNumbers);

    // 物件住所から座標を取得（距離マッチング用）
    const coordsStartTime = Date.now();
    const propertyCoords = await this.getPropertyCoordsFromAddress(property);
    console.log(`[BuyerCandidateService] Coords extraction time: ${Date.now() - coordsStartTime}ms`);

    // 買主を全件取得（配信種別「要」のみ）
    // パフォーマンス: 約1000-1500件、処理時間約10秒
    const buyers: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    
    const buyersStartTime = Date.now();
    while (true) {
      const { data, error: buyersError } = await this.supabase
        .from('buyers')
        .select('buyer_number,name,latest_status,desired_area,desired_property_type,reception_date,email,phone_number,property_number,distribution_type,inquiry_source,broker_inquiry,price_range_house,price_range_apartment,price_range_land')
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
    console.log(`[BuyerCandidateService] Buyers fetch time: ${Date.now() - buyersStartTime}ms`);
    console.log(`[BuyerCandidateService] Total buyers fetched: ${buyers.length}`);

    // フィルタリング（最適化版 - 距離マッチングを条件付きで実行）
    const filterStartTime = Date.now();
    const candidates = await this.filterCandidatesOptimized(
      buyers || [],
      property.property_type,
      property.sales_price,
      propertyAreaNumbers,
      propertyCoords
    );
    console.log(`[BuyerCandidateService] Filtering time: ${Date.now() - filterStartTime}ms`);

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
    const addressStartTime = Date.now();
    const propertyAddressMap = await this.getPropertyAddressesInBatch(Array.from(allPropertyNumbers));
    console.log(`[BuyerCandidateService] Address batch fetch time: ${Date.now() - addressStartTime}ms`);

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

    const endTime = Date.now();
    console.log(`[BuyerCandidateService] Total processing time: ${endTime - startTime}ms`);

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
   * 買主候補をフィルタリング（同期処理 - 距離マッチングは無効化済みのため非同期不要）
   */
  private filterCandidates(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): any[] {
    return buyers.filter(buyer => {
      if (this.shouldExcludeBuyer(buyer)) return false;
      if (!this.matchesStatus(buyer)) return false;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) return false;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) return false;
      if (!this.matchesAreaCriteria(buyer, propertyAreaNumbers)) return false;
      return true;
    });
  }

  /**
   * 買主候補をフィルタリング（非同期処理 - 距離マッチング対応）
   * 配信エリアマッチングまたは半役3km距離マッチングのいずれかを満たす買主を返す
   */
  private async filterCandidatesAsync(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<any[]> {
    const candidates: any[] = [];

    for (const buyer of buyers) {
      // 既存フィルタを先に適用
      if (this.shouldExcludeBuyer(buyer)) continue;
      if (!this.matchesStatus(buyer)) continue;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) continue;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) continue;

      // 配信エリアマッチング（OR条件の前半）
      if (this.matchesAreaCriteria(buyer, propertyAreaNumbers)) {
        candidates.push(buyer);
        continue; // 距離計算をスキップ（重複計算回避）
      }

      // 距離マッチング（OR条件の後半）
      if (propertyCoords) {
        const matchesByDistance = await this.matchesByInquiryDistance(buyer, propertyCoords, this.geocodingCache);
        if (matchesByDistance) {
          candidates.push(buyer);
        }
      }
    }

    return candidates;
  }

  /**
   * 買主候補をフィルタリング（最適化版 - 距離マッチングを条件付きで実行）
   * パフォーマンス最適化:
   * 1. エリアマッチングで50件以上見つかった場合、距離マッチングをスキップ
   * 2. 距離マッチングは最大100件まで実行
   */
  private async filterCandidatesOptimized(
    buyers: any[],
    propertyType: string | null,
    salesPrice: number | null,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<any[]> {
    const candidates: any[] = [];
    const candidatesWithoutDistance: any[] = [];

    // フェーズ1: エリアマッチングのみで候補を収集
    for (const buyer of buyers) {
      // 既存フィルタを先に適用
      if (this.shouldExcludeBuyer(buyer)) continue;
      if (!this.matchesStatus(buyer)) continue;
      if (!this.matchesPropertyTypeCriteria(buyer, propertyType)) continue;
      if (!this.matchesPriceCriteria(buyer, salesPrice, propertyType)) continue;

      // 配信エリアマッチング
      if (this.matchesAreaCriteria(buyer, propertyAreaNumbers)) {
        candidates.push(buyer);
      } else {
        // エリアマッチングしなかった買主を保存（距離マッチング用）
        candidatesWithoutDistance.push(buyer);
      }
    }

    console.log(`[BuyerCandidateService] Area matching candidates: ${candidates.length}`);

    // フェーズ2: エリアマッチングで50件未満の場合のみ、距離マッチングを実行
    if (candidates.length < 50 && propertyCoords && candidatesWithoutDistance.length > 0) {
      console.log(`[BuyerCandidateService] Running distance matching for ${candidatesWithoutDistance.length} buyers`);
      
      // 距離マッチングは最大100件まで実行（パフォーマンス最適化）
      const maxDistanceChecks = Math.min(100, candidatesWithoutDistance.length);
      
      for (let i = 0; i < maxDistanceChecks; i++) {
        const buyer = candidatesWithoutDistance[i];
        const matchesByDistance = await this.matchesByInquiryDistance(buyer, propertyCoords, this.geocodingCache);
        if (matchesByDistance) {
          candidates.push(buyer);
          
          // 50件に達したら早期終了
          if (candidates.length >= 50) {
            console.log(`[BuyerCandidateService] Early termination: 50 candidates found`);
            break;
          }
        }
      }
    } else {
      console.log(`[BuyerCandidateService] Skipping distance matching (${candidates.length} candidates found by area matching)`);
    }

    return candidates;
  }

  /**
   * 買主を除外すべきかどうかを判定
   * 以下のいずれかに該当する場合、除外する:
   * 1. 業者問合せである
   * 2. 希望エリアと希望種別が両方空欄である
   * 3. 配信種別が「要」でない
   */
  private shouldExcludeBuyer(buyer: any): boolean {
    // デバッグログ（買主6752の場合のみ）
    if (buyer.buyer_number === '6752') {
      console.log(`[BuyerCandidateService] Buyer 6752 exclusion check:`);
      console.log(`  - Is business inquiry: ${this.isBusinessInquiry(buyer)}`);
      console.log(`  - Has minimum criteria: ${this.hasMinimumCriteria(buyer)}`);
      console.log(`  - Has distribution required: ${this.hasDistributionRequired(buyer)}`);
      console.log(`  - distribution_type: ${buyer.distribution_type}`);
      console.log(`  - latest_status: ${buyer.latest_status}`);
    }
    
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
   * エリア条件によるフィルタリング（同期）
   * - 買主の希望エリアが空欄の場合: 条件を満たす
   * - 物件の配信エリアと買主の希望エリアが1つでも合致: 条件を満たす
   */
  private matchesAreaCriteria(
    buyer: any,
    propertyAreaNumbers: string[]
  ): boolean {
    const desiredArea = (buyer.desired_area || '').trim();

    // 希望エリアが空欄の場合は条件を満たす
    if (!desiredArea) {
      return true;
    }

    // エリア番号でのマッチング
    if (propertyAreaNumbers.length > 0) {
      const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);
      const matches = propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
      
      // デバッグログ（買主6752の場合のみ）
      if (buyer.buyer_number === '6752') {
        console.log(`[BuyerCandidateService] Buyer 6752 area matching:`);
        console.log(`  - Desired area: ${desiredArea}`);
        console.log(`  - Buyer area numbers: ${JSON.stringify(buyerAreaNumbers)}`);
        console.log(`  - Property area numbers: ${JSON.stringify(propertyAreaNumbers)}`);
        console.log(`  - Matches: ${matches}`);
      }
      
      return matches;
    }

    return false;
  }

  /**
   * エリア条件によるフィルタリング（距離ベースも含む・将来用）
   * 現在は距離マッチングを無効化しているため matchesAreaCriteria を使用
   */
  private async matchesAreaCriteriaWithDistance(
    buyer: any,
    propertyAreaNumbers: string[],
    propertyCoords: { lat: number; lng: number } | null
  ): Promise<boolean> {
    return this.matchesAreaCriteria(buyer, propertyAreaNumbers);
  }

  /**
   * 買主が問い合わせた物件との距離でマッチング（GeocodingService使用・キャッシュ対応）
   * 買主が以前に問い合わせた物件が近傇13km以内であれば条件を満たす
   */
  private async matchesByInquiryDistance(
    buyer: any,
    propertyCoords: { lat: number; lng: number },
    geocodingCache: Map<string, { lat: number; lng: number } | null>
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

      // キャッシュを確認
      if (geocodingCache.has(firstPropertyNumber)) {
        const cachedCoords = geocodingCache.get(firstPropertyNumber);
        if (!cachedCoords) {
          return false;
        }
        const distance = this.geolocationService.calculateDistance(propertyCoords, cachedCoords);
        return distance <= 3.0;
      }

      // property_listings から住所・座標・google_map_url を取得
      const { data: inquiryProperty, error } = await this.supabase
        .from('property_listings')
        .select('address, latitude, longitude, google_map_url')
        .eq('property_number', firstPropertyNumber)
        .single();

      if (error || !inquiryProperty) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      let inquiryCoords: { lat: number; lng: number } | null = null;

      // DBに保存済みの latitude/longitude カラムのみ使用（リアルタイムURL展開は行わない）
      if (inquiryProperty.latitude != null && inquiryProperty.longitude != null) {
        inquiryCoords = { lat: inquiryProperty.latitude, lng: inquiryProperty.longitude };
      }

      if (!inquiryCoords) {
        geocodingCache.set(firstPropertyNumber, null);
        return false;
      }

      geocodingCache.set(firstPropertyNumber, inquiryCoords);

      const distance = this.geolocationService.calculateDistance(propertyCoords, inquiryCoords);
      console.log(`[BuyerCandidateService] Distance from inquiry property ${firstPropertyNumber}: ${distance.toFixed(2)}km`);

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

    // 希望種別が空欄または「指定なし」の場合は種別問わず対象
    if (!desiredType || desiredType === '指定なし') {
      return true;
    }

    if (!propertyType) {
      return false;
    }

    const normalizedPropertyType = this.normalizePropertyType(propertyType);
    const normalizedDesiredTypes = desiredType.split(/[,、・\s]+/).map((t: string) => this.normalizePropertyType(t));

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

    if (normalizedType === '戸建' || normalizedType === '戸' || normalizedType === 'detached_house') {
      priceRange = buyer.price_range_house;
    } else if (normalizedType === 'マンション' || normalizedType === 'マ' || normalizedType === 'アパート' || normalizedType === 'apartment') {
      priceRange = buyer.price_range_apartment;
    } else if (normalizedType === '土地' || normalizedType === '土' || normalizedType === 'land') {
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

      // distribution_areasフィールドから丸数字のみ抽出
      // 住所からの自動エリア拡張（㊵㊶による大分市・別府市全域マッチング）は行わない
      // 理由: 住所から自動追加すると、distribution_areasに設定されていないエリアの買主まで
      //       誤って配信対象に含まれてしまうため
      const distributionAreas = property.distribution_areas || property.distribution_area || '';
      if (distributionAreas) {
        const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
        extracted.forEach((num: string) => areaNumbers.add(num));
      }

      const result = Array.from(areaNumbers);
      console.log(`[BuyerCandidateService] Area numbers for property (from distribution_areas only):`, result);
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
   * 物件の座標を取得
   * DBに保存済みの latitude/longitude カラムのみ使用（リアルタイムURL展開は行わない）
   */
  private async getPropertyCoordsFromAddress(property: any): Promise<{ lat: number; lng: number } | null> {
    try {
      // latitude/longitude カラムを使用（DBに保存済みの座標）
      if (property.latitude != null && property.longitude != null) {
        console.log(`[BuyerCandidateService] Using stored coords for ${property.property_number}: (${property.latitude}, ${property.longitude})`);
        return { lat: property.latitude, lng: property.longitude };
      }

      // 座標がなければスキップ
      console.log(`[BuyerCandidateService] No stored coords for ${property.property_number}, skipping distance matching`);
      return null;
    } catch (error) {
      console.error(`[BuyerCandidateService] Error getting property coords:`, error);
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
