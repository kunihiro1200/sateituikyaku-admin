import * as crypto from 'crypto';
import { BaseRepository } from '../repositories/BaseRepository';
import { SellerService } from './SellerService.supabase';
import { valuationCalculatorService } from './ValuationCalculatorService';
import { normalizePropertyType, isApartment } from '../utils/propertyTypeNormalizer';
import { calcBrokerageFee, calcStampDuty, calcTransferTax, TransferTaxInput } from '../utils/proceedsCalculator';
import { calculateSaleScheduleFromSettlement } from '../utils/saleScheduleCalculator';

/**
 * 査定依頼者向け「売却サポートページ」のサービス層。
 *
 * 既存の査定額（sellers.valuation_amount_1/2/3）・査定計算ロジック（ValuationCalculatorService）・
 * 手残り計算ロジック（proceedsCalculator、NetProceedsListModal.tsxと同一計算式）を流用する。
 * 新しい査定ロジックは作らない。
 */

export interface ValuationSummary {
  minimumPrice: number; // valuation_amount_1（最低額・早期売却重視価格）
  midPrice: number; // valuation_amount_2（中間額・成約想定価格）
  maximumPrice: number; // valuation_amount_3（最高額・チャレンジ価格）
  propertyType: 'land' | 'detached_house' | 'apartment' | 'other';
}

export interface PropertySummary {
  ownerName: string | null; // 「様」付き
  propertyTypeLabel: string; // 表示用の種別ラベル（土地/戸建て/マンション等）
  address: string | null;
  landArea: number | null; // ㎡。当社調べ（_verified）を優先
  buildingArea: number | null; // ㎡。当社調べ（_verified）を優先。マンションは専有面積として使う
}

export class SellerPortalService extends BaseRepository {
  private sellerService = new SellerService();

  /**
   * トークン用の乱数を生成し、SHA-256ハッシュを返す。
   * 平文はこの関数の戻り値としてのみ得られ、DBにはハッシュだけを保存する。
   */
  generateToken(): { plainToken: string; tokenHash: string } {
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    return { plainToken, tokenHash };
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * スタッフ返信メール通知用のトークンを発行する。
   * issueToken() とは異なり、既存の有効なトークンを無効化しない（売主がホーム画面に設置済みの
   * PWAリンクを壊さないため）。同じ売主に対して複数の有効トークンが並存してよい設計とする。
   */
  async issueAdditionalToken(sellerId: string, sellerNumber: string): Promise<string> {
    const { plainToken, tokenHash } = this.generateToken();

    const { error } = await this.table('seller_portal_tokens').insert({
      seller_id: sellerId,
      seller_number: sellerNumber,
      token_hash: tokenHash,
    });

    if (error) throw new Error(`トークン発行に失敗しました: ${error.message}`);

    return plainToken;
  }

  /** 有効な（無効化・期限切れでない）トークンが既に存在するかを確認する */
  async hasActiveToken(sellerId: string): Promise<boolean> {
    const { data } = await this.table('seller_portal_tokens')
      .select('id, expires_at')
      .eq('seller_id', sellerId)
      .is('revoked_at', null);

    if (!data || data.length === 0) return false;
    const now = Date.now();
    return data.some((row: any) => !row.expires_at || new Date(row.expires_at).getTime() > now);
  }

  /**
   * 専用URLトークンを新規発行する（スタッフ操作、要認証）。
   * 既存の有効なトークンがあれば無効化してから新規発行する（1売主1トークン運用）。
   */
  async issueToken(sellerId: string, sellerNumber: string): Promise<string> {
    await this.table('seller_portal_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('seller_id', sellerId)
      .is('revoked_at', null);

    const { plainToken, tokenHash } = this.generateToken();

    const { error } = await this.table('seller_portal_tokens').insert({
      seller_id: sellerId,
      seller_number: sellerNumber,
      token_hash: tokenHash,
    });

    if (error) throw new Error(`トークン発行に失敗しました: ${error.message}`);

    return plainToken;
  }

  /**
   * トークンを検証し、有効なら売主情報を返す。アクセス記録も更新する。
   */
  async verifyToken(token: string): Promise<{ sellerId: string; sellerNumber: string } | null> {
    const tokenHash = this.hashToken(token);

    const { data, error } = await this.table('seller_portal_tokens')
      .select('id, seller_id, seller_number, revoked_at, expires_at, access_count')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !data) return null;
    if (data.revoked_at) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

    await this.table('seller_portal_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (data.access_count ?? 0) + 1,
      })
      .eq('id', data.id);

    return { sellerId: data.seller_id, sellerNumber: data.seller_number };
  }

  /**
   * スタッフ管理画面向け：売主のトークン発行状況・アクセス状況を取得する。
   */
  async getTokenStatus(sellerId: string): Promise<any | null> {
    const { data } = await this.table('seller_portal_tokens')
      .select('issued_at, expires_at, revoked_at, last_accessed_at, access_count')
      .eq('seller_id', sellerId)
      .is('revoked_at', null)
      .order('issued_at', { ascending: false })
      .limit(1)
      .single();

    return data ?? null;
  }

  // ============================================================
  // 査定額・査定根拠
  // ============================================================

  /**
   * 物件概要（売主名・種別・住所・面積）を取得する。売却サポートページの査定額カード上部に表示する。
   * 面積は当社調べ（_verified）があればそれを優先する（既存のカラム優先順位ルールと同じ）。
   */
  async getPropertySummary(sellerId: string): Promise<PropertySummary | null> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) return null;

    const ownerName = seller.name ? `${seller.name.trim()} 様` : null;
    const propertyType = normalizePropertyType(seller.propertyType ?? seller.property?.propertyType);
    const propertyTypeLabel =
      propertyType === 'land' ? '土地'
      : propertyType === 'detached_house' ? '戸建て'
      : propertyType === 'apartment' ? 'マンション'
      : (seller.propertyType ?? seller.property?.propertyType ?? '種別不明');

    const address = seller.property?.address || seller.propertyAddress || null;
    const landArea = seller.property?.landAreaVerified || seller.property?.landArea || seller.landArea || null;
    const buildingArea = seller.property?.buildingAreaVerified || seller.property?.buildingArea || seller.buildingArea || null;

    return { ownerName, propertyTypeLabel, address, landArea, buildingArea };
  }

  /**
   * 査定額（最低/中間/最高）を取得する。既存のsellers.valuation_amount_1/2/3をそのまま使う。
   * 新しい査定は行わない。
   */
  async getValuationSummary(sellerId: string): Promise<ValuationSummary | null> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) return null;

    const minimumPrice = seller.valuationAmount1 ?? 0;
    const midPrice = seller.valuationAmount2 ?? 0;
    const maximumPrice = seller.valuationAmount3 ?? 0;

    return {
      minimumPrice,
      midPrice,
      maximumPrice,
      propertyType: normalizePropertyType(seller.propertyType ?? seller.property?.propertyType),
    };
  }

  /**
   * 査定根拠を取得する。
   * - 土地・戸建：seller_valuation_breakdowns に保存済みの内訳があればそれを返す。
   *   無い場合は「内訳データがない」ことを明示するフラグを返し、AIで根拠を作らない。
   * - マンション：専有面積単価をその場で計算する（保存不要）。同マンション売買事例は
   *   現状DBに保存する仕組みが存在しないため、無い場合はその旨を返す。
   */
  async getValuationBreakdown(sellerId: string): Promise<any> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) return null;

    const propertyType = normalizePropertyType(seller.propertyType ?? seller.property?.propertyType);

    if (isApartment(seller.propertyType ?? seller.property?.propertyType)) {
      const midPrice = seller.valuationAmount2 ?? 0;
      const maxPrice = seller.valuationAmount3 ?? 0;
      const minPrice = seller.valuationAmount1 ?? 0;
      const exclusiveArea = seller.property?.buildingAreaVerified || seller.property?.buildingArea || seller.buildingArea || 0;

      const unitPricePerSqm = exclusiveArea > 0 ? Math.round((midPrice / exclusiveArea) * 100) / 100 : null;

      return {
        propertyType,
        exclusiveArea,
        midPrice,
        maxPrice,
        minPrice,
        unitPricePerSqm, // 円/㎡
        hasSalesCaseData: false, // 現状、同マンション売買事例の保存機能は存在しない
      };
    }

    // 土地・戸建
    const { data: breakdown } = await this.table('seller_valuation_breakdowns')
      .select('*')
      .eq('seller_id', sellerId)
      .single();

    const minimumPrice = seller.valuationAmount1 ?? 0;
    const midPrice = seller.valuationAmount2 ?? 0;
    const maximumPrice = seller.valuationAmount3 ?? 0;

    if (!breakdown) {
      return {
        propertyType,
        hasBreakdown: false, // 内訳データが存在しない売主。総額のみ表示すること（AIで根拠を作らない）
        minimumPrice,
        midPrice,
        maximumPrice,
      };
    }

    // 🚨 重要：表示は「後付けの差分」ではなく、実際の計算ステップ（ValuationCalculatorService.
    // calculateValuationAmount1）をそのまま再現する。
    //   ① 土地価格 = 土地面積 × 固定資産税路線価 ÷ 0.6（路線価は実勢価格の約60%という前提で市場価格に割り戻す）
    //   ② 建物価格 = 建築単価 × 建物面積 − 経年減価
    //   ③ 小計 = 土地価格 + 建物価格
    //   ④ 小計 × 1.2倍
    //   ⑤ 1000万円以上なら +300万円
    //   ⑥ 10万円単位で切り捨て → 早期売却を重視した価格（最低価格）
    // この6ステップの計算結果が必ず minimumPrice と一致する。
    const landPrice = breakdown.land_price ?? 0;
    const buildingPrice = breakdown.building_price ?? 0;
    const subtotal = landPrice + buildingPrice;
    const afterMultiplier = subtotal * 1.2; // ④ 市場性を考慮した価格（円）
    const basePriceMan = Math.round(afterMultiplier / 10000); // 万円単位に丸め
    const largeAmountBonus = basePriceMan >= 1000 ? 3_000_000 : 0; // ⑤ 1000万円以上なら+300万円

    return {
      propertyType,
      hasBreakdown: true,
      landAreaUsed: breakdown.land_area_used,
      fixedAssetTaxRoadPriceUsed: breakdown.fixed_asset_tax_road_price_used,
      landPrice,
      buildingAreaUsed: breakdown.building_area_used,
      buildingAgeUsed: breakdown.building_age_used,
      structureUsed: breakdown.structure_used,
      constructionUnitPriceUsed: breakdown.construction_unit_price_used,
      buildingPrice,
      subtotal,
      afterMultiplier,
      largeAmountBonus,
      additionAmount2: breakdown.addition_amount_2,
      additionAmount3: breakdown.addition_amount_3,
      minimumPrice,
      midPrice,
      maximumPrice,
    };
  }

  /**
   * 査定を再計算し、内訳を seller_valuation_breakdowns に保存する（スタッフ操作、要認証）。
   * 既存の ValuationCalculatorService.calculateValuationBreakdown() をそのまま使う。
   * マンションは内訳保存の対象外（呼び出し元でチェックすること）。
   */
  async recalculateAndSaveBreakdown(sellerId: string): Promise<void> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) throw new Error('売主が見つかりません');
    if (!seller.property) throw new Error('物件情報が見つかりません');

    await this.saveValuationBreakdown(seller, seller.property);
  }

  /**
   * 査定額1の自動計算（POST /:sellerId/calculate-valuation-amount1 等）が呼ばれたタイミングで、
   * 査定根拠（土地価格・建物価格・加算額の内訳）を保存する。土地・戸建のみが対象。
   * seller・propertyInfo は呼び出し元（valuations.ts）が既に取得済みのものをそのまま渡してもらう。
   */
  async saveValuationBreakdown(seller: any, propertyInfo: any): Promise<void> {
    if (!seller?.id) throw new Error('売主IDが不明です');

    const breakdown = await valuationCalculatorService.calculateValuationBreakdown(seller, propertyInfo);

    const { error } = await this.table('seller_valuation_breakdowns').upsert(
      {
        seller_id: seller.id,
        seller_number: seller.sellerNumber,
        land_area_used: breakdown.landAreaUsed,
        fixed_asset_tax_road_price_used: breakdown.fixedAssetTaxRoadPriceUsed,
        land_price: breakdown.landPrice,
        building_area_used: breakdown.buildingAreaUsed,
        building_age_used: breakdown.buildingAgeUsed,
        structure_used: breakdown.structureUsed,
        construction_unit_price_used: breakdown.constructionUnitPriceUsed,
        building_price: breakdown.buildingPrice,
        addition_amount_2: breakdown.additionAmount2,
        addition_amount_3: breakdown.additionAmount3,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' }
    );

    if (error) throw new Error(`査定根拠の保存に失敗しました: ${error.message}`);
  }

  // ============================================================
  // ざっくり手残り
  // ============================================================

  /**
   * ざっくり手残り一覧。最高査定額から100万円刻みで最低査定額まで、
   * 仲介手数料・印紙代のみを差し引いた概算手残りを返す（既存のNetProceedsListModal計算式を流用）。
   */
  async getRoughProceeds(sellerId: string): Promise<Array<{ priceYen: number; brokerageFee: number; stampDuty: number; netProceeds: number }>> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) throw new Error('売主が見つかりません');

    const maxYen = seller.valuationAmount3 ?? 0;
    const minYen = seller.valuationAmount1 ?? 0;
    if (maxYen <= 0) return [];

    const step = 1_000_000; // 100万円刻み
    const prices: number[] = [];
    for (let p = maxYen; p >= (minYen > 0 ? minYen : maxYen - step * 9); p -= step) {
      prices.push(p);
    }
    if (minYen > 0 && prices[prices.length - 1] > minYen) prices.push(minYen);

    return prices.map((priceYen) => {
      const brokerageFee = calcBrokerageFee(priceYen);
      const stampDuty = calcStampDuty(priceYen);
      return {
        priceYen,
        brokerageFee,
        stampDuty,
        netProceeds: priceYen - brokerageFee - stampDuty,
      };
    });
  }

  // ============================================================
  // 詳細手残り（譲渡所得税等を含む）
  // ============================================================

  /**
   * 詳細手残り一覧。ざっくり手残りに加えて、住宅ローン残高・抵当権抹消費用・譲渡所得税・
   * 特別控除を考慮する。入力（known_facts）は seller_portal_preferences に保存済みの値を使う。
   */
  async getDetailedProceeds(
    sellerId: string,
    input: {
      loanBalance?: number; // ローン残高（円）
      mortgageReleaseFee?: number; // 抵当権抹消費用（円）
      transferTax: TransferTaxInput;
    }
  ): Promise<Array<{
    priceYen: number;
    brokerageFee: number;
    stampDuty: number;
    loanBalance: number;
    mortgageReleaseFee: number;
    transferTax: number;
    netProceeds: number;
  }>> {
    const seller = await this.sellerService.getSeller(sellerId);
    if (!seller) throw new Error('売主が見つかりません');

    const maxYen = seller.valuationAmount3 ?? 0;
    const minYen = seller.valuationAmount1 ?? 0;
    if (maxYen <= 0) return [];

    const step = 1_000_000;
    const prices: number[] = [];
    for (let p = maxYen; p >= (minYen > 0 ? minYen : maxYen - step * 9); p -= step) {
      prices.push(p);
    }
    if (minYen > 0 && prices[prices.length - 1] > minYen) prices.push(minYen);

    const loanBalance = input.loanBalance ?? 0;
    const mortgageReleaseFee = input.mortgageReleaseFee ?? 0;

    return prices.map((priceYen) => {
      const brokerageFee = calcBrokerageFee(priceYen);
      const stampDuty = calcStampDuty(priceYen);
      const { taxAmount } = calcTransferTax({ ...input.transferTax, salePrice: priceYen });
      const netProceeds =
        priceYen - brokerageFee - stampDuty - loanBalance - mortgageReleaseFee - taxAmount;
      return {
        priceYen,
        brokerageFee,
        stampDuty,
        loanBalance,
        mortgageReleaseFee,
        transferTax: taxAmount,
        netProceeds,
      };
    });
  }
  // ============================================================
  // 希望条件（売却スケジュール入力）・閲覧状況
  // ============================================================

  /**
   * 希望条件を取得する。存在しない場合は査定額から初期値を作って返す（保存はしない）。
   */
  async getPreferences(sellerId: string): Promise<any> {
    const { data } = await this.table('seller_portal_preferences')
      .select('*')
      .eq('seller_id', sellerId)
      .single();

    if (data) return data;

    const seller = await this.sellerService.getSeller(sellerId);
    return {
      seller_id: sellerId,
      seller_number: seller?.sellerNumber ?? null,
      desired_sale_price: seller?.valuationAmount3 ?? null,
      minimum_sale_price: seller?.valuationAmount1 ?? null,
      desired_settlement_year_month: null,
      known_facts: {},
      viewed_rough_proceeds_at: null,
      viewed_detailed_proceeds_at: null,
      detailed_proceeds_completed: false,
    };
  }

  async upsertPreferences(
    sellerId: string,
    sellerNumber: string,
    updates: {
      desiredSalePrice?: number;
      minimumSalePrice?: number;
      desiredSettlementYearMonth?: string; // 'YYYY-MM-01'
    }
  ): Promise<void> {
    const payload: Record<string, any> = { seller_id: sellerId, seller_number: sellerNumber };
    if (updates.desiredSalePrice !== undefined) payload.desired_sale_price = updates.desiredSalePrice;
    if (updates.minimumSalePrice !== undefined) payload.minimum_sale_price = updates.minimumSalePrice;
    if (updates.desiredSettlementYearMonth !== undefined) {
      payload.desired_settlement_year_month = updates.desiredSettlementYearMonth;
      // 決済希望月が新規入力・変更された場合は、スタッフ確認済みフラグをリセットする。
      // これにより「サイドバーで気づいたら未確認」というサイクルが機能する
      // （Google Chat通知の代わりに、サイドバーカテゴリーで気づく設計に変更したため）。
      payload.staff_confirmed_settlement_at = null;
    }

    const { error } = await this.table('seller_portal_preferences').upsert(payload, { onConflict: 'seller_id' });
    if (error) throw new Error(`希望条件の保存に失敗しました: ${error.message}`);
  }

  /** スタッフが「いつまでに売りたいか」の入力を確認したことを記録する（サイドバーカテゴリーから外すため） */
  async confirmSettlementInput(sellerId: string, sellerNumber: string): Promise<void> {
    const { error } = await this.table('seller_portal_preferences').upsert(
      { seller_id: sellerId, seller_number: sellerNumber, staff_confirmed_settlement_at: new Date().toISOString() },
      { onConflict: 'seller_id' }
    );
    if (error) throw new Error(`確認状態の保存に失敗しました: ${error.message}`);
  }

  /**
   * 売主が「買取依頼」ボタンを押したことを記録する。
   * 決済希望月までの期間が短く（逆算した販売開始が過去日になる）場合に表示するボタンから呼ばれる。
   */
  async requestBuyout(sellerId: string, sellerNumber: string): Promise<void> {
    const { error } = await this.table('seller_portal_preferences').upsert(
      {
        seller_id: sellerId,
        seller_number: sellerNumber,
        buyout_requested_at: new Date().toISOString(),
        staff_confirmed_buyout_at: null, // 新規依頼のため未確認状態にする
      },
      { onConflict: 'seller_id' }
    );
    if (error) throw new Error(`買取依頼の保存に失敗しました: ${error.message}`);
  }

  /** スタッフが買取依頼を確認したことを記録する（サイドバーカテゴリーから外すため） */
  async confirmBuyoutRequest(sellerId: string, sellerNumber: string): Promise<void> {
    const { error } = await this.table('seller_portal_preferences').upsert(
      { seller_id: sellerId, seller_number: sellerNumber, staff_confirmed_buyout_at: new Date().toISOString() },
      { onConflict: 'seller_id' }
    );
    if (error) throw new Error(`確認状態の保存に失敗しました: ${error.message}`);
  }

  async updateKnownFacts(sellerId: string, sellerNumber: string, facts: Record<string, any>): Promise<void> {
    const { data } = await this.table('seller_portal_preferences')
      .select('known_facts')
      .eq('seller_id', sellerId)
      .single();

    const existing = data?.known_facts ?? {};
    const now = new Date().toISOString();
    const merged = { ...existing };
    for (const [key, value] of Object.entries(facts)) {
      merged[key] = { value, answeredAt: now };
    }

    const { error } = await this.table('seller_portal_preferences').upsert(
      { seller_id: sellerId, seller_number: sellerNumber, known_facts: merged },
      { onConflict: 'seller_id' }
    );
    if (error) throw new Error(`回答の保存に失敗しました: ${error.message}`);
  }

  async markViewed(sellerId: string, sellerNumber: string, field: 'rough' | 'detailed'): Promise<void> {
    const column = field === 'rough' ? 'viewed_rough_proceeds_at' : 'viewed_detailed_proceeds_at';
    const payload: Record<string, any> = {
      seller_id: sellerId,
      seller_number: sellerNumber,
      [column]: new Date().toISOString(),
    };
    if (field === 'detailed') payload.detailed_proceeds_completed = true;

    const { error } = await this.table('seller_portal_preferences').upsert(payload, { onConflict: 'seller_id' });
    if (error) throw new Error(`閲覧状況の保存に失敗しました: ${error.message}`);
  }

  // ============================================================
  // 売却スケジュール（逆算）
  // ============================================================

  /**
   * 希望条件（売りたい価格・最低価格・決済希望年月）から売却スケジュールを算出する。
   * 期間の考え方は既存のSaleScheduleModal.tsxのオフセットをそのまま使う（逆算のみ新規）。
   */
  async calculateSchedule(sellerId: string): Promise<any> {
    const prefs = await this.getPreferences(sellerId);
    if (!prefs.desired_settlement_year_month) {
      return { hasSettlementDate: false };
    }

    const settlementDate = new Date(prefs.desired_settlement_year_month);
    const schedule = calculateSaleScheduleFromSettlement({
      desiredSettlementYear: settlementDate.getFullYear(),
      desiredSettlementMonth: settlementDate.getMonth() + 1,
    });

    return {
      hasSettlementDate: true,
      desiredSalePrice: prefs.desired_sale_price,
      minimumSalePrice: prefs.minimum_sale_price,
      ...schedule,
    };
  }

  // ============================================================
  // スタッフ⇄売主チャット
  // ============================================================

  async startOrGetConversation(
    sellerId: string,
    sellerNumber: string,
    contextTag: 'general' | 'valuation' | 'valuation_breakdown' | 'net_proceeds' | 'schedule'
  ): Promise<string> {
    const { data: existing } = await this.table('seller_portal_conversations')
      .select('id')
      .eq('seller_id', sellerId)
      .eq('context_tag', contextTag)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) return existing.id;

    const { data, error } = await this.table('seller_portal_conversations')
      .insert({ seller_id: sellerId, seller_number: sellerNumber, context_tag: contextTag })
      .select('id')
      .single();

    if (error) throw new Error(`相談スレッドの作成に失敗しました: ${error.message}`);
    return data.id;
  }

  async sendMessage(params: {
    conversationId: string;
    sellerNumber: string;
    senderType: 'seller' | 'staff';
    senderEmployeeId?: string;
    content: string;
  }): Promise<void> {
    const { error } = await this.table('seller_portal_messages').insert({
      conversation_id: params.conversationId,
      seller_number: params.sellerNumber,
      sender_type: params.senderType,
      sender_employee_id: params.senderEmployeeId ?? null,
      content: params.content,
    });
    if (error) throw new Error(`メッセージの送信に失敗しました: ${error.message}`);
  }

  async getConversationsWithMessages(sellerId: string): Promise<any[]> {
    const { data: conversations, error } = await this.table('seller_portal_conversations')
      .select('id, context_tag, created_at')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`相談履歴の取得に失敗しました: ${error.message}`);
    if (!conversations || conversations.length === 0) return [];

    const conversationIds = conversations.map((c: any) => c.id);
    const { data: messages } = await this.table('seller_portal_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    return conversations.map((c: any) => ({
      ...c,
      messages: (messages ?? []).filter((m: any) => m.conversation_id === c.id),
    }));
  }

  /** 売主側が読んだタイミングで、スタッフからのメッセージを既読にする */
  async markMessagesReadBySeller(conversationId: string): Promise<void> {
    await this.table('seller_portal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'staff')
      .is('read_at', null);
  }

  /** スタッフ側が読んだタイミングで、売主からのメッセージを既読にする */
  async markMessagesReadByStaff(conversationId: string): Promise<void> {
    await this.table('seller_portal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'seller')
      .is('read_at', null);
  }

  // ============================================================
  // サイドバーカテゴリー「売却サポート：対応が必要」向け集計
  // ============================================================

  /**
   * 「売却サポートページで対応が必要」な売主の seller_id 一覧を返す。
   * 対象は次のいずれかを満たす売主：
   *   ① 決済希望月が入力済みで、まだスタッフが確認していない
   *   ② 売主からスタッフへの未読メッセージがある
   * 既存の visitThankYouPending カテゴリー（sellers以外のテーブルとJOINする実装）と同じ
   * パターンで、候補IDを取得してJSでOR条件を判定する。
   */
  async getSellerIdsNeedingPortalAttention(): Promise<Set<string>> {
    const result = new Set<string>();

    // ① 決済希望月が入力済み・未確認
    const { data: pendingSettlement } = await this.table('seller_portal_preferences')
      .select('seller_id')
      .not('desired_settlement_year_month', 'is', null)
      .is('staff_confirmed_settlement_at', null);
    for (const row of pendingSettlement ?? []) result.add(row.seller_id);

    // ①-2 買取依頼済み・未確認
    const { data: pendingBuyout } = await this.table('seller_portal_preferences')
      .select('seller_id')
      .not('buyout_requested_at', 'is', null)
      .is('staff_confirmed_buyout_at', null);
    for (const row of pendingBuyout ?? []) result.add(row.seller_id);

    // ② 売主からの未読メッセージがある会話を持つ売主
    const { data: unreadMessages } = await this.table('seller_portal_messages')
      .select('conversation_id')
      .eq('sender_type', 'seller')
      .is('read_at', null);

    const conversationIds = Array.from(new Set((unreadMessages ?? []).map((m: any) => m.conversation_id)));
    if (conversationIds.length > 0) {
      // Supabaseの .in() 上限対策で500件ずつチャンク分割する（既存のvisitThankYouPendingと同じ対策）
      const chunkSize = 500;
      for (let i = 0; i < conversationIds.length; i += chunkSize) {
        const chunk = conversationIds.slice(i, i + chunkSize);
        const { data: conversations } = await this.table('seller_portal_conversations')
          .select('seller_id')
          .in('id', chunk);
        for (const row of conversations ?? []) result.add(row.seller_id);
      }
    }

    return result;
  }

  /** スタッフ管理画面向け：売主単位の未読件数（売主からスタッフへの未読メッセージ数） */
  async getUnreadCountForStaff(sellerId: string): Promise<number> {
    const { data: conversations } = await this.table('seller_portal_conversations')
      .select('id')
      .eq('seller_id', sellerId);

    if (!conversations || conversations.length === 0) return 0;
    const conversationIds = conversations.map((c: any) => c.id);

    const { count } = await this.table('seller_portal_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('sender_type', 'seller')
      .is('read_at', null);

    return count ?? 0;
  }
}

export const sellerPortalService = new SellerPortalService();
