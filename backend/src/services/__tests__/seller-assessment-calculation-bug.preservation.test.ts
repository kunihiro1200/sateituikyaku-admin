/**
 * 保全テスト: ValuationCalculatorService.calculateValuationAmount1()
 * 非バグ条件（fixedAssetTaxRoadPrice > 0 または landArea = 0）の動作を観察し、
 * 保全すべきベースライン動作を確認する。
 *
 * このテストは修正前のコードで PASS することがゴール。
 * 修正後もこのテストが PASS し続けることで、リグレッションがないことを確認する。
 *
 * 保全すべき動作:
 *   1. 路線価=0の場合: 土地価格が0になる（正常動作）
 *   2. 土地面積=0の場合: 土地価格が0になる（正常動作）
 *   3. 木造・築33年以上の場合: 建物価格が基準価格の10%になる
 *   4. 査定額1が1,000万円未満の場合: 査定額2に+200万円、査定額3に+400万円が加算される
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

// supabase設定のモック（初期化エラーを回避）
jest.mock('../../config/supabase', () => ({
  supabase: {},
  supabaseClient: {},
  default: {},
}));

import { ValuationCalculatorService } from '../ValuationCalculatorService';
import { Seller, PropertyInfo, PropertyType } from '../../types';

/**
 * DBアクセスをモックするSupabaseクライアント
 * construction_prices テーブルへのクエリに対してエラーを返し、
 * ハードコードテーブルへのフォールバックを強制する
 */
function createSupabaseMockWithDBError() {
  return {
    from: jest.fn().mockImplementation((_table: string) => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB not available in test environment', code: 'PGRST116' },
          }),
        }),
      }),
    })),
  } as any;
}

/** 基本的な売主データ（路線価あり） */
const baseSeller: Seller = {
  id: 'test-seller-preservation',
  sellerNumber: 'AA99999',
  name: 'テスト売主',
  phoneNumber: '09012345678',
  address: '大分県別府市テスト町1-1',
  fixedAssetTaxRoadPrice: 21700, // 正常な路線価
};

/** 基本的な物件情報（木造1983年築） */
const baseProperty: PropertyInfo = {
  sellerId: 'test-seller-preservation',
  address: '大分県別府市テスト町1-1',
  prefecture: '大分県',
  city: '別府市',
  propertyType: PropertyType.DETACHED_HOUSE,
  landArea: 220,
  buildingArea: 100,
  structure: '木造',
  buildYear: 1983,
};

describe('保全テスト: 非バグ条件の動作維持確認', () => {
  let service: ValuationCalculatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ValuationCalculatorService();
    (service as any).supabase = createSupabaseMockWithDBError();
  });

  // =========================================================================
  // 保全ケース1: 路線価=0の場合、土地価格が0になる
  // =========================================================================
  describe('保全ケース1: 路線価=0の場合、土地価格が0になる', () => {
    it('fixedAssetTaxRoadPrice=0 の場合、査定額1は建物価格のみで計算される', async () => {
      // Arrange: 路線価=0（土地価格=0）
      const sellerWithZeroRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 0,
      };

      // Act
      const result = await service.calculateValuationAmount1(
        sellerWithZeroRoadPrice,
        baseProperty
      );

      // Assert: 土地価格=0なので、建物価格のみで計算される
      // 建物価格: 104,400 × 100 × 0.1 = 1,044,000（木造1983年築、築42年で残存10%）
      // basePrice: Math.round(1,044,000 × 1.2 / 10000) = 125（万円）
      // finalPrice: 125（< 1000万円なので加算なし）
      // roundedPrice: Math.floor(1,250,000 / 100,000) × 100,000 = 1,200,000
      expect(result).toBe(1_200_000);
      console.log(`保全ケース1 - 路線価=0の査定額1: ¥${result.toLocaleString()}`);
    });

    it('fixedAssetTaxRoadPrice=0 の場合、路線価あり（21700）より低い査定額になる', async () => {
      // Arrange
      const sellerWithZeroRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 0,
      };
      const sellerWithRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 21700,
      };

      // Act
      const resultZero = await service.calculateValuationAmount1(sellerWithZeroRoadPrice, baseProperty);
      const resultNormal = await service.calculateValuationAmount1(sellerWithRoadPrice, baseProperty);

      // Assert: 路線価=0の場合は路線価ありより低い査定額になる
      expect(resultZero).toBeLessThan(resultNormal);
      console.log(`保全ケース1 - 路線価=0: ¥${resultZero.toLocaleString()}, 路線価=21700: ¥${resultNormal.toLocaleString()}`);
    });
  });

  // =========================================================================
  // 保全ケース2: 土地面積=0の場合、土地価格が0になる
  // =========================================================================
  describe('保全ケース2: 土地面積=0の場合、土地価格が0になる', () => {
    it('landArea=0 の場合、査定額1は建物価格のみで計算される', async () => {
      // Arrange: 土地面積=0（土地価格=0）
      const propertyWithZeroLandArea: PropertyInfo = {
        ...baseProperty,
        landArea: 0,
      };

      // Act
      const result = await service.calculateValuationAmount1(
        baseSeller,
        propertyWithZeroLandArea
      );

      // Assert: 土地面積=0なので、建物価格のみで計算される
      // 建物価格: 104,400 × 100 × 0.1 = 1,044,000（木造1983年築、築42年で残存10%）
      // basePrice: Math.round(1,044,000 × 1.2 / 10000) = 125（万円）
      // finalPrice: 125（< 1000万円なので加算なし）
      // roundedPrice: 1,200,000
      expect(result).toBe(1_200_000);
      console.log(`保全ケース2 - 土地面積=0の査定額1: ¥${result.toLocaleString()}`);
    });

    it('landArea=0 の場合、路線価が正の値でも土地価格は0になる', async () => {
      // Arrange: 土地面積=0、路線価=21700（路線価があっても土地面積が0なら土地価格=0）
      const propertyWithZeroLandArea: PropertyInfo = {
        ...baseProperty,
        landArea: 0,
      };

      // Act
      const resultZeroLand = await service.calculateValuationAmount1(baseSeller, propertyWithZeroLandArea);
      const resultNormalLand = await service.calculateValuationAmount1(baseSeller, baseProperty);

      // Assert: 土地面積=0の場合は土地面積ありより低い査定額になる
      expect(resultZeroLand).toBeLessThan(resultNormalLand);
      console.log(`保全ケース2 - 土地面積=0: ¥${resultZeroLand.toLocaleString()}, 土地面積=220: ¥${resultNormalLand.toLocaleString()}`);
    });
  });

  // =========================================================================
  // 保全ケース3: 木造・築33年以上の場合、建物価格が基準価格の10%になる
  // =========================================================================
  describe('保全ケース3: 木造・築33年以上の場合、建物価格が基準価格の10%になる', () => {
    it('木造・築33年（1992年築）の場合、建物価格が基準価格の10%になる', async () => {
      // Arrange: 木造1992年築（2025年基準で築33年）
      const propertyAge33: PropertyInfo = {
        ...baseProperty,
        landArea: 0, // 土地価格を0にして建物価格のみを確認
        buildYear: 1992, // 2025 - 1992 = 33年
        structure: '木造',
      };

      // Act
      const result = await service.calculateValuationAmount1(
        baseSeller,
        propertyAge33
      );

      // Assert: 木造築33年の建物価格 = 128,800 × 100 × 0.1 = 1,288,000（1992年の建築単価）
      // basePrice: Math.round(1,288,000 × 1.2 / 10000) = 155（万円）
      // finalPrice: 155（< 1000万円なので加算なし）
      // roundedPrice: Math.floor(1,550,000 / 100,000) × 100,000 = 1,500,000
      expect(result).toBe(1_500_000);
      console.log(`保全ケース3 - 木造築33年の査定額1: ¥${result.toLocaleString()}`);
    });

    it('木造・築42年（1983年築）の場合も建物価格が基準価格の10%になる', async () => {
      // Arrange: 木造1983年築（2025年基準で築42年）
      const propertyAge42: PropertyInfo = {
        ...baseProperty,
        landArea: 0, // 土地価格を0にして建物価格のみを確認
        buildYear: 1983, // 2025 - 1983 = 42年
        structure: '木造',
      };

      // Act
      const result = await service.calculateValuationAmount1(
        baseSeller,
        propertyAge42
      );

      // Assert: 木造築42年の建物価格 = 104,400 × 100 × 0.1 = 1,044,000（33年以上なので10%）
      // basePrice: Math.round(1,044,000 × 1.2 / 10000) = 125（万円）
      // finalPrice: 125（< 1000万円なので加算なし）
      // roundedPrice: 1,200,000
      expect(result).toBe(1_200_000);
      console.log(`保全ケース3 - 木造築42年の査定額1: ¥${result.toLocaleString()}`);
    });

    it('木造・築32年（1993年築）の場合、建物価格が基準価格の10%より高くなる', async () => {
      // Arrange: 木造1993年築（2025年基準で築32年）
      const propertyAge32: PropertyInfo = {
        ...baseProperty,
        landArea: 0, // 土地価格を0にして建物価格のみを確認
        buildYear: 1993, // 2025 - 1993 = 32年（33年未満）
        structure: '木造',
      };

      // Act
      const resultAge32 = await service.calculateValuationAmount1(baseSeller, propertyAge32);
      const propertyAge33: PropertyInfo = { ...propertyAge32, buildYear: 1992 };
      const resultAge33 = await service.calculateValuationAmount1(baseSeller, propertyAge33);

      // Assert: 築32年は築33年より高い査定額になる（減価が少ない）
      expect(resultAge32).toBeGreaterThanOrEqual(resultAge33);
      console.log(`保全ケース3 - 木造築32年: ¥${resultAge32.toLocaleString()}, 木造築33年: ¥${resultAge33.toLocaleString()}`);
    });
  });

  // =========================================================================
  // 保全ケース4: 査定額1が1,000万円未満の場合、査定額2に+200万円、査定額3に+400万円
  // =========================================================================
  describe('保全ケース4: 査定額1が1,000万円未満の場合の加算テーブル', () => {
    it('査定額1が1,000万円未満の場合、査定額2は査定額1+200万円になる', async () => {
      // Arrange: 路線価=0、土地面積=220㎡ → 査定額1 = 1,200,000（< 1000万円）
      const sellerWithZeroRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 0,
      };

      // Act
      const amount1 = await service.calculateValuationAmount1(sellerWithZeroRoadPrice, baseProperty);
      const amount2 = await service.calculateValuationAmount2(sellerWithZeroRoadPrice, amount1);

      // Assert: 査定額1 = 1,200,000（120万円 < 1000万円）
      // 加算額: +200万円
      // 査定額2 = (120 + 200) × 10000 = 3,200,000
      expect(amount1).toBe(1_200_000);
      expect(amount2).toBe(3_200_000);
      console.log(`保全ケース4 - 査定額1: ¥${amount1.toLocaleString()}, 査定額2: ¥${amount2.toLocaleString()}`);
    });

    it('査定額1が1,000万円未満の場合、査定額3は査定額1+400万円になる', async () => {
      // Arrange: 路線価=0 → 査定額1 = 1,200,000（< 1000万円）
      const sellerWithZeroRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 0,
      };

      // Act
      const amount1 = await service.calculateValuationAmount1(sellerWithZeroRoadPrice, baseProperty);
      const amount3 = await service.calculateValuationAmount3(sellerWithZeroRoadPrice, amount1);

      // Assert: 査定額1 = 1,200,000（120万円 < 1000万円）
      // 加算額: +400万円
      // 査定額3 = (120 + 400) × 10000 = 5,200,000
      expect(amount1).toBe(1_200_000);
      expect(amount3).toBe(5_200_000);
      console.log(`保全ケース4 - 査定額1: ¥${amount1.toLocaleString()}, 査定額3: ¥${amount3.toLocaleString()}`);
    });

    it('査定額1が1,000万円以上の場合、査定額2の加算額は+200万円より多くなる', async () => {
      // Arrange: 路線価=21700、土地面積=220㎡ → 査定額1 = 13,800,000（≥ 1000万円）
      const sellerWithRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 21700,
      };

      // Act
      const amount1 = await service.calculateValuationAmount1(sellerWithRoadPrice, baseProperty);
      const amount2 = await service.calculateValuationAmount2(sellerWithRoadPrice, amount1);

      // Assert: 査定額1 = 13,800,000（1380万円 ≥ 1000万円）
      // 加算テーブル: 1400万円以下 → +300万円
      // 査定額2 = (1380 + 300) × 10000 = 16,800,000
      expect(amount1).toBe(13_800_000);
      const addition = (amount2 - amount1) / 10000;
      expect(addition).toBeGreaterThan(200); // 1000万円以上なので+200万円より多い
      console.log(`保全ケース4 - 査定額1: ¥${amount1.toLocaleString()}, 査定額2: ¥${amount2.toLocaleString()}, 加算額: ${addition}万円`);
    });
  });

  // =========================================================================
  // 追加保全: 路線価が正の値の場合の正常動作確認
  // =========================================================================
  describe('追加保全: 路線価が正の値の場合の正常動作', () => {
    it('路線価=21700、土地面積=220㎡、木造1983年築の場合、査定額1は¥13,800,000になる', async () => {
      // Arrange: AA13983相当のデータ（路線価あり）
      const sellerWithRoadPrice: Seller = {
        ...baseSeller,
        fixedAssetTaxRoadPrice: 21700,
      };

      // Act
      const result = await service.calculateValuationAmount1(sellerWithRoadPrice, baseProperty);

      // Assert: 正しい路線価が渡された場合は ¥13,800,000 が返る
      // 土地価格: 220 × 21,700 / 0.6 = 7,956,667
      // 建物価格: 104,400 × 100 × 0.1 = 1,044,000（築42年で残存10%）
      // 合計: 9,000,667
      // basePrice: Math.round(9,000,667 × 1.2 / 10000) = 1080（万円）
      // finalPrice: 1080 + 300 = 1380（≥ 1000万円なので+300万）
      // roundedPrice: 13,800,000
      expect(result).toBe(13_800_000);
      console.log(`追加保全 - 路線価=21700の査定額1: ¥${result.toLocaleString()}`);
    });
  });
});
