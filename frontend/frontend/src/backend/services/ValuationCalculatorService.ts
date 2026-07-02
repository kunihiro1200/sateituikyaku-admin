import { BaseRepository } from '../repositories/BaseRepository';
import { PropertyInfo, Seller } from '../types';

/**
 * 査定額計算サービス
 * 複雑な査定額計算ロジックを実装
 */
export class ValuationCalculatorService extends BaseRepository {
  /**
   * 査定額1を計算（詳細な計算式）
   */
  async calculateValuationAmount1(
    seller: Seller,
    property: PropertyInfo
  ): Promise<number> {
    try {
      // 必要なデータの取得
      const buildYear = property.buildYear || 0;
      const structure = property.structure || '木造';
      const buildingArea = property.buildingAreaVerified || property.buildingArea || 0;
      const landArea = property.landAreaVerified || property.landArea || 0;
      const fixedAssetTaxRoadPrice = seller.fixedAssetTaxRoadPrice || 0;
      
      console.log('📋 Input data:', {
        buildYear,
        structure,
        buildingArea,
        landArea,
        fixedAssetTaxRoadPrice,
        sellerFixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice
      });

      // 築年数の計算（2025年基準）
      const currentYear = 2025;
      const buildingAge = buildYear > 0 ? currentYear - buildYear : 0;

      // 建築単価の取得
      const constructionUnitPrice = await this.getConstructionUnitPrice(buildYear, structure);
      console.log('🏗️ Construction unit price:', constructionUnitPrice);

      // 建築価格の計算
      const constructionPrice = this.calculateConstructionPrice(
        constructionUnitPrice,
        buildingArea,
        buildingAge,
        structure
      );
      console.log('🏠 Construction price:', constructionPrice);

      // 土地価格の計算
      const landPrice = this.calculateLandPrice(landArea, fixedAssetTaxRoadPrice);
      console.log('🏞️ Land price:', landPrice);

      // 合計
      const total = constructionPrice + landPrice;
      console.log('💵 Total (construction + land):', total);

      // ベース価格（万円単位に丸める）
      const basePrice = Math.round((total * 1.2) / 10000);
      console.log('📊 Base price after 1.2x (万円):', basePrice);

      // 最終査定額（1000万円以上の場合は300万円を加算）
      const finalPrice = basePrice >= 1000 ? basePrice + 300 : basePrice;
      console.log('🎯 Final price (万円):', finalPrice);

      // 円に変換してから10万円単位で切り捨て
      const finalPriceInYen = finalPrice * 10000;
      const roundedPrice = Math.floor(finalPriceInYen / 100000) * 100000;
      console.log('💰 Final price after rounding to 100,000 yen:', roundedPrice);

      // 計算結果が0以下の場合はエラー（物件情報不足）
      if (roundedPrice <= 0) {
        throw new Error('土地面積または建物面積が未入力のため、査定額を自動計算できません。物件情報を入力するか、手入力で査定額を設定してください。');
      }

      return roundedPrice;
    } catch (error) {
      console.error('Valuation calculation error:', error);
      throw error;
    }
  }

  /**
   * 建築単価を取得
   */
  private async getConstructionUnitPrice(
    buildYear: number,
    structure: string
  ): Promise<number> {
    console.log('🔍 Getting construction unit price for:', { buildYear, structure });
    
    // 築年が0または空白の場合のデフォルト値（2024年の価格）
    if (!buildYear || buildYear === 0) {
      console.log('⚠️ Build year is 0 or empty, using default');
      return this.getDefaultConstructionPrice(structure);
    }

    // まずハードコードされた価格データから取得を試みる
    const hardcodedPrice = this.getHardcodedConstructionPrice(buildYear, structure);
    if (hardcodedPrice) {
      console.log('✅ Got price from hardcoded data:', hardcodedPrice);
      return hardcodedPrice;
    }

    // データベースから建築価格を取得
    const { data, error } = await this.table('construction_prices')
      .select('*')
      .eq('year', buildYear)
      .single();

    console.log('📊 Database query result:', { data, error: error?.message });

    if (error || !data) {
      console.log('⚠️ No data found for year, trying nearest year');
      // データが見つからない場合は最も近い年のデータを取得
      const { data: nearestData } = await this.table('construction_prices')
        .select('*')
        .order('year', { ascending: false })
        .limit(1)
        .single();

      console.log('📊 Nearest data:', nearestData);

      if (!nearestData) {
        // フォールバック値
        console.log('⚠️ No nearest data, using default');
        return this.getDefaultConstructionPrice(structure);
      }

      return this.getPriceByStructure(nearestData, structure);
    }

    const price = this.getPriceByStructure(data, structure);
    console.log('✅ Got price from database:', price);
    return price;
  }

  /**
   * ハードコードされた建築価格データから取得
   * データベースが利用できない場合のフォールバック
   */
  private getHardcodedConstructionPrice(year: number, structure: string): number | null {
    const priceData: { [key: number]: { wood: number; lightSteel: number; steel: number; rc: number; src: number } } = {
      2022: { wood: 176200, lightSteel: 241500, steel: 241500, rc: 277500, src: 434400 },
      2023: { wood: 204100, lightSteel: 366700, steel: 281100, rc: 366700, src: 314300 },
      2024: { wood: 204100, lightSteel: 366700, steel: 281100, rc: 366700, src: 314300 },
      2025: { wood: 204100, lightSteel: 366700, steel: 281100, rc: 366700, src: 314300 },
    };

    const yearData = priceData[year];
    if (!yearData) {
      return null;
    }

    switch (structure) {
      case '木造':
      case '不明':
      case '未確認':
      case '':
        return yearData.wood;
      case '軽量鉄骨':
        return yearData.lightSteel;
      case '鉄骨':
        return yearData.steel;
      case '鉄筋コンクリート':
        return yearData.rc;
      case '鉄骨鉄筋コンクリート':
        return yearData.src;
      default:
        return yearData.wood;
    }
  }

  /**
   * 構造に応じた価格を取得
   */
  private getPriceByStructure(data: any, structure: string): number {
    switch (structure) {
      case '木造':
      case '不明':
      case '未確認':
      case '':
        return data.wood_price;
      case '軽量鉄骨':
        return data.light_steel_price;
      case '鉄骨':
        return data.steel_price;
      case '鉄筋コンクリート':
        return data.reinforced_concrete_price;
      case '鉄骨鉄筋コンクリート':
        return data.steel_reinforced_concrete_price;
      default:
        return data.wood_price;
    }
  }

  /**
   * デフォルトの建築価格を取得
   * 2024年の最新価格を使用
   */
  private getDefaultConstructionPrice(structure: string): number {
    switch (structure) {
      case '木造':
      case '不明':
      case '未確認':
      case '':
        return 204100;
      case '軽量鉄骨':
        return 366700;
      case '鉄骨':
        return 281100;
      case '鉄筋コンクリート':
        return 366700;
      case '鉄骨鉄筋コンクリート':
        return 314300;
      default:
        return 204100;
    }
  }

  /**
   * 建築価格を計算
   * 
   * 計算式:
   * - 木造: 建築単価 × 建物面積 - (建築単価 × 建物面積 × 0.9 × 築年数 × 0.031)
   *   33年で残存価値10%
   * - 鉄骨: 建築単価 × 建物面積 - (建築単価 × 建物面積 × 0.9 × 築年数 × 0.0225)
   *   40年で残存価値10%
   * - 軽量鉄骨: 建築単価 × 建物面積 - (建築単価 × 建物面積 × 0.9 × 築年数 × 0.0225)
   *   40年で残存価値10%
   * 
   * 例: 木造2021年築（築3年）、建物面積99.2㎡、建築単価153,000円/㎡
   *     153,000 × 99.2 - (153,000 × 99.2 × 0.9 × 3 × 0.031) = 15,175,862円
   */
  private calculateConstructionPrice(
    unitPrice: number,
    buildingArea: number,
    buildingAge: number,
    structure: string
  ): number {
    if (buildingArea === 0) {
      return 0;
    }

    // 基準価格
    const basePrice = unitPrice * buildingArea;

    // 構造に応じた減価計算
    if (structure === '木造' || !structure) {
      // 木造の場合：33年で残存価値10%
      // 減価率 = 0.9 / 33 = 0.027272... ≈ 0.031（調整後）
      if (buildingAge >= 33) {
        return basePrice * 0.1;
      }
      const depreciation = basePrice * 0.9 * buildingAge * 0.031;
      return basePrice - depreciation;
    } else if (structure === '鉄骨') {
      // 鉄骨の場合：40年で残存価値10%
      // 減価率 = 0.9 / 40 = 0.0225
      if (buildingAge >= 40) {
        return basePrice * 0.1;
      }
      const depreciation = basePrice * 0.9 * buildingAge * 0.0225;
      return basePrice - depreciation;
    } else if (structure === '軽量鉄骨') {
      // 軽量鉄骨の場合：40年で残存価値10%
      // 減価率 = 0.9 / 40 = 0.0225
      if (buildingAge >= 40) {
        return basePrice * 0.1;
      }
      const depreciation = basePrice * 0.9 * buildingAge * 0.0225;
      return basePrice - depreciation;
    }

    // その他の構造（減価なし）
    return basePrice;
  }

  /**
   * 土地価格を計算
   * 
   * 計算式: 土地面積 × 固定資産税路線価 / 0.6
   * 
   * 固定資産税路線価は実勢価格の約60%とされているため、
   * 0.6で割ることで実勢価格を推定します。
   * 
   * 例: 土地面積165.3㎡、固定資産税路線価21,900円/㎡
   *     165.3 × 21,900 / 0.6 = 6,033,450円
   */
  private calculateLandPrice(landArea: number, fixedAssetTaxRoadPrice: number): number {
    if (landArea === 0 || fixedAssetTaxRoadPrice === 0) {
      return 0;
    }

    // 固定資産税路線価から実勢価格を推定（路線価は実勢価格の約60%）
    return landArea * fixedAssetTaxRoadPrice / 0.6;
  }

  /**
   * 査定額2を計算
   * 査定額1に基づいて加算額を計算
   */
  async calculateValuationAmount2(
    seller: Seller,
    valuationAmount1: number
  ): Promise<number> {
    try {
      // 査定額1を万円単位に変換
      const amount1InManYen = valuationAmount1 / 10000;

      // 段階的な加算額を決定
      let addition = 0;
      if (amount1InManYen <= 1000) {
        addition = 200;
      } else if (amount1InManYen <= 1400) {
        addition = 300;
      } else if (amount1InManYen <= 1900) {
        addition = 300;
      } else if (amount1InManYen <= 2400) {
        addition = 350;
      } else if (amount1InManYen <= 2900) {
        addition = 400;
      } else if (amount1InManYen <= 3400) {
        addition = 450;
      } else if (amount1InManYen <= 3900) {
        addition = 500;
      } else if (amount1InManYen <= 4400) {
        addition = 550;
      } else if (amount1InManYen <= 4900) {
        addition = 600;
      } else if (amount1InManYen <= 5400) {
        addition = 650;
      } else if (amount1InManYen <= 5900) {
        addition = 700;
      } else if (amount1InManYen <= 6400) {
        addition = 750;
      } else if (amount1InManYen <= 6900) {
        addition = 800;
      } else if (amount1InManYen <= 7400) {
        addition = 850;
      } else if (amount1InManYen <= 7900) {
        addition = 900;
      } else if (amount1InManYen <= 8400) {
        addition = 950;
      } else if (amount1InManYen <= 8900) {
        addition = 1000;
      } else if (amount1InManYen <= 9400) {
        addition = 1050;
      } else if (amount1InManYen <= 9900) {
        addition = 1100;
      } else {
        addition = 1150;
      }

      // 査定額2 = 査定額1 + 加算額（万円単位で計算して円に戻す）
      return (amount1InManYen + addition) * 10000;
    } catch (error) {
      console.error('Valuation amount 2 calculation error:', error);
      throw error;
    }
  }

  /**
   * 査定額3を計算
   * 査定額1に基づいて加算額を計算
   */
  async calculateValuationAmount3(
    seller: Seller,
    valuationAmount1: number
  ): Promise<number> {
    try {
      // 査定額1を万円単位に変換
      const amount1InManYen = valuationAmount1 / 10000;

      // 段階的な加算額を決定
      let addition = 0;
      if (amount1InManYen <= 1000) {
        addition = 400;
      } else if (amount1InManYen <= 1400) {
        addition = 500;
      } else if (amount1InManYen <= 1900) {
        addition = 500;
      } else if (amount1InManYen <= 2400) {
        addition = 550;
      } else if (amount1InManYen <= 2900) {
        addition = 600;
      } else if (amount1InManYen <= 3400) {
        addition = 650;
      } else if (amount1InManYen <= 3900) {
        addition = 700;
      } else if (amount1InManYen <= 4400) {
        addition = 750;
      } else if (amount1InManYen <= 4900) {
        addition = 800;
      } else if (amount1InManYen <= 5400) {
        addition = 850;
      } else if (amount1InManYen <= 5900) {
        addition = 900;
      } else if (amount1InManYen <= 6400) {
        addition = 950;
      } else if (amount1InManYen <= 6900) {
        addition = 1000;
      } else if (amount1InManYen <= 7400) {
        addition = 1050;
      } else if (amount1InManYen <= 7900) {
        addition = 1100;
      } else if (amount1InManYen <= 8400) {
        addition = 1150;
      } else if (amount1InManYen <= 8900) {
        addition = 1200;
      } else if (amount1InManYen <= 9400) {
        addition = 1250;
      } else if (amount1InManYen <= 9900) {
        addition = 1300;
      } else {
        addition = 1350;
      }

      // 査定額3 = 査定額1 + 加算額（万円単位で計算して円に戻す）
      return (amount1InManYen + addition) * 10000;
    } catch (error) {
      console.error('Valuation amount 3 calculation error:', error);
      throw error;
    }
  }
}

export const valuationCalculatorService = new ValuationCalculatorService();
