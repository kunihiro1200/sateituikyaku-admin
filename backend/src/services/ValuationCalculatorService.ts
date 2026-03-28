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
    // スプレッドシート「建築価格」シートのデータ（1965〜2025年）
    // 列: 木造, 軽量鉄骨, 鉄筋コンクリート, 鉄骨鉄筋コンクリート, 鉄骨
    const priceData: { [key: number]: { wood: number; lightSteel: number; steel: number; rc: number; src: number } } = {
      1965: { wood: 16800,  lightSteel: 17900,  steel: 17900,  rc: 30300,  src: 45000  },
      1966: { wood: 18200,  lightSteel: 17800,  steel: 17800,  rc: 30600,  src: 42400  },
      1967: { wood: 19900,  lightSteel: 19600,  steel: 19600,  rc: 33700,  src: 43600  },
      1968: { wood: 22200,  lightSteel: 21700,  steel: 21700,  rc: 36200,  src: 48600  },
      1969: { wood: 24900,  lightSteel: 23600,  steel: 23600,  rc: 39000,  src: 50900  },
      1970: { wood: 28000,  lightSteel: 26100,  steel: 26100,  rc: 42900,  src: 54300  },
      1971: { wood: 31200,  lightSteel: 30300,  steel: 30300,  rc: 47200,  src: 61200  },
      1972: { wood: 34200,  lightSteel: 32400,  steel: 32400,  rc: 50200,  src: 61600  },
      1973: { wood: 45300,  lightSteel: 42200,  steel: 42200,  rc: 64300,  src: 77600  },
      1974: { wood: 61800,  lightSteel: 55700,  steel: 55700,  rc: 90100,  src: 113000 },
      1975: { wood: 67700,  lightSteel: 60500,  steel: 60500,  rc: 97400,  src: 126400 },
      1976: { wood: 70300,  lightSteel: 62100,  steel: 62100,  rc: 98200,  src: 114600 },
      1977: { wood: 74100,  lightSteel: 65300,  steel: 65300,  rc: 102000, src: 121800 },
      1978: { wood: 77900,  lightSteel: 70100,  steel: 70100,  rc: 105900, src: 122400 },
      1979: { wood: 82500,  lightSteel: 75400,  steel: 75400,  rc: 114300, src: 128900 },
      1980: { wood: 92500,  lightSteel: 84100,  steel: 84100,  rc: 129700, src: 149400 },
      1981: { wood: 98300,  lightSteel: 91700,  steel: 91700,  rc: 138700, src: 161800 },
      1982: { wood: 101300, lightSteel: 94400,  steel: 94400,  rc: 143200, src: 166900 },
      1983: { wood: 104400, lightSteel: 97200,  steel: 97200,  rc: 147800, src: 172200 },
      1984: { wood: 106800, lightSteel: 99500,  steel: 99500,  rc: 151200, src: 176100 },
      1985: { wood: 109300, lightSteel: 101900, steel: 101900, rc: 154700, src: 180200 },
      1986: { wood: 111900, lightSteel: 104300, steel: 104300, rc: 158300, src: 184400 },
      1987: { wood: 114500, lightSteel: 106700, steel: 106700, rc: 161900, src: 188700 },
      1988: { wood: 117200, lightSteel: 109200, steel: 109200, rc: 165600, src: 193000 },
      1989: { wood: 120000, lightSteel: 111800, steel: 111800, rc: 169400, src: 197400 },
      1990: { wood: 122900, lightSteel: 114500, steel: 114500, rc: 173300, src: 201900 },
      1991: { wood: 125800, lightSteel: 117200, steel: 117200, rc: 177300, src: 206500 },
      1992: { wood: 128800, lightSteel: 120000, steel: 120000, rc: 181400, src: 211200 },
      1993: { wood: 131900, lightSteel: 122900, steel: 122900, rc: 185600, src: 216000 },
      1994: { wood: 135100, lightSteel: 125900, steel: 125900, rc: 189900, src: 221000 },
      1995: { wood: 138300, lightSteel: 128900, steel: 128900, rc: 194300, src: 226100 },
      1996: { wood: 141600, lightSteel: 132000, steel: 132000, rc: 198800, src: 231300 },
      1997: { wood: 145000, lightSteel: 135100, steel: 135100, rc: 203400, src: 236700 },
      1998: { wood: 148500, lightSteel: 138400, steel: 138400, rc: 208100, src: 242200 },
      1999: { wood: 152100, lightSteel: 141700, steel: 141700, rc: 212900, src: 247800 },
      2000: { wood: 155800, lightSteel: 145100, steel: 145100, rc: 217800, src: 253600 },
      2001: { wood: 153000, lightSteel: 142600, steel: 142600, rc: 213900, src: 249000 },
      2002: { wood: 150300, lightSteel: 140100, steel: 140100, rc: 210100, src: 244500 },
      2003: { wood: 147600, lightSteel: 137700, steel: 137700, rc: 206400, src: 240100 },
      2004: { wood: 145000, lightSteel: 135300, steel: 135300, rc: 202800, src: 235800 },
      2005: { wood: 142400, lightSteel: 132900, steel: 132900, rc: 199200, src: 231600 },
      2006: { wood: 139900, lightSteel: 130500, steel: 130500, rc: 195700, src: 227500 },
      2007: { wood: 137400, lightSteel: 128200, steel: 128200, rc: 192300, src: 223500 },
      2008: { wood: 135000, lightSteel: 125900, steel: 125900, rc: 188900, src: 219600 },
      2009: { wood: 132700, lightSteel: 123700, steel: 123700, rc: 185600, src: 215800 },
      2010: { wood: 130400, lightSteel: 121500, steel: 121500, rc: 182400, src: 212100 },
      2011: { wood: 135000, lightSteel: 135000, steel: 135000, rc: 197000, src: 265400 },
      2012: { wood: 157600, lightSteel: 155600, steel: 155600, rc: 193900, src: 223300 },
      2013: { wood: 159900, lightSteel: 164300, steel: 164300, rc: 203800, src: 258500 },
      2014: { wood: 163000, lightSteel: 176400, steel: 176400, rc: 228000, src: 276200 },
      2015: { wood: 165400, lightSteel: 197300, steel: 197300, rc: 240200, src: 262200 },
      2016: { wood: 165900, lightSteel: 204100, steel: 204100, rc: 254200, src: 308300 },
      2017: { wood: 166700, lightSteel: 214600, steel: 214600, rc: 265500, src: 350400 },
      2018: { wood: 168500, lightSteel: 214100, steel: 214100, rc: 263100, src: 304200 },
      2019: { wood: 170100, lightSteel: 228800, steel: 228800, rc: 285600, src: 363300 },
      2020: { wood: 172000, lightSteel: 230200, steel: 230200, rc: 277000, src: 279200 },
      2021: { wood: 172200, lightSteel: 227300, steel: 227300, rc: 288300, src: 338400 },
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
      // 鉄骨の場合：スプレッドシートの計算式に合わせて減価率0.015を使用
      if (buildingAge >= 40) {
        return basePrice * 0.1;
      }
      const depreciation = basePrice * 0.9 * buildingAge * 0.015;
      return basePrice - depreciation;
    } else if (structure === '軽量鉄骨') {
      // 軽量鉄骨の場合：スプレッドシートの計算式に合わせて減価率0.025を使用
      if (buildingAge >= 40) {
        return basePrice * 0.1;
      }
      const depreciation = basePrice * 0.9 * buildingAge * 0.025;
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
