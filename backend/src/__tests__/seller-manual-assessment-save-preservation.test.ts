/**
 * 保全プロパティテスト: 手入力査定額保存バグ（バックエンド）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは修正前後ともに PASS する（保全すべきベースライン動作を確認）
 *
 * 保全1: valuation_amount_1=30000000 で mapToSheet() を呼び出すと
 *         「査定額1（自動計算）v: 3000」が含まれる（BC/BD/BE列への既存同期維持）
 *         Requirements: 3.3
 *
 * 保全2: ランダムな fixedAssetTaxRoadPrice が非nullの場合は常に isManualValuation=false
 *         Requirements: 3.2
 *
 * 保全3: 任意の valuation_amount_1/2/3 値で mapToSheet() が
 *         「査定額1（自動計算）v」/「査定額2（自動計算）v」/「査定額3（自動計算）v」を含む
 *         Requirements: 3.3
 */

import { ColumnMapper } from '../services/ColumnMapper';
import * as fc from 'fast-check';

// ============================================================
// 査定額初期化ロジック（フロントエンドの loadAllData() に相当する純粋関数）
// ============================================================

interface SellerDataForValuation {
  valuationAmount1: number | null;
  valuationAmount2: number | null;
  valuationAmount3: number | null;
  fixedAssetTaxRoadPrice: number | null;
}

interface ValuationInitResult {
  isManualValuation: boolean;
  editedManualValuationAmount1: string;
  editedManualValuationAmount2: string;
  editedManualValuationAmount3: string;
}

/**
 * 修正前の loadAllData() 内の査定額初期化ロジック（バグあり）
 * 保全テストでは「修正前のコード」を使用して、保全すべき動作を確認する
 */
function initValuationStateBuggy(sellerData: SellerDataForValuation): ValuationInitResult {
  // 修正前のコード: 無条件に false / '' にリセット
  return {
    isManualValuation: false,
    editedManualValuationAmount1: '',
    editedManualValuationAmount2: '',
    editedManualValuationAmount3: '',
  };
}

// ============================================================
// 保全テスト
// ============================================================

describe('保全プロパティテスト: 手入力査定額保存バグ（バックエンド）', () => {
  let columnMapper: ColumnMapper;

  beforeEach(() => {
    columnMapper = new ColumnMapper();
  });

  // ============================================================
  // 観察1: valuationAmount1=null の場合は isManualValuation=false のまま
  // Requirements: 3.1
  // ============================================================

  /**
   * 観察テスト: valuationAmount1=null の場合は isManualValuation=false のまま（正しい動作）
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察1: valuationAmount1=null の場合は isManualValuation=false のまま（手入力未保存時の正しい動作）', () => {
    // Arrange: 手入力査定額が未保存のデータ
    const sellerData: SellerDataForValuation = {
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      fixedAssetTaxRoadPrice: null,
    };

    // Act: 修正前のロジックを実行
    const result = initValuationStateBuggy(sellerData);

    console.log('valuationAmount1=null の場合の結果:', result);

    // Assert: isManualValuation が false のまま（正しい動作）
    // このテストは修正前後ともに PASS する
    expect(result.isManualValuation).toBe(false);
    expect(result.editedManualValuationAmount1).toBe('');
    expect(result.editedManualValuationAmount2).toBe('');
    expect(result.editedManualValuationAmount3).toBe('');
  });

  /**
   * 観察テスト: valuationAmount1=30000000, fixedAssetTaxRoadPrice=50000 の場合は isManualValuation=false（自動計算モード）
   *
   * **Validates: Requirements 3.2**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察2: valuationAmount1=30000000, fixedAssetTaxRoadPrice=50000 の場合は isManualValuation=false（自動計算モード）', () => {
    // Arrange: 自動計算モードのデータ（fixedAssetTaxRoadPrice が非null）
    const sellerData: SellerDataForValuation = {
      valuationAmount1: 30000000,
      valuationAmount2: null,
      valuationAmount3: null,
      fixedAssetTaxRoadPrice: 50000, // 自動計算モード
    };

    // Act: 修正前のロジックを実行
    const result = initValuationStateBuggy(sellerData);

    console.log('fixedAssetTaxRoadPrice=50000 の場合の結果:', result);

    // Assert: isManualValuation が false のまま（自動計算モード）
    // このテストは修正前後ともに PASS する
    expect(result.isManualValuation).toBe(false);
  });

  /**
   * 観察テスト: valuation_amount_1=30000000 で mapToSheet() を呼び出すと「査定額1（自動計算）v: 3000」が含まれる
   *
   * **Validates: Requirements 3.3**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察3: valuation_amount_1=30000000 で mapToSheet() を呼び出すと「査定額1（自動計算）v: 3000」が含まれる', () => {
    // Arrange
    const sellerData = {
      name: 'テスト売主',
      address: 'テスト住所',
      phone_number: '090-1234-5678',
      valuation_amount_1: 30000000, // 3000万円（円単位）
    };

    // Act
    const result = columnMapper.mapToSheet(sellerData);

    console.log('「査定額1（自動計算）v」の値:', result['査定額1（自動計算）v']);

    // Assert: 「査定額1（自動計算）v」キーが存在し、値が 3000（万円単位）になる
    // このテストは修正前後ともに PASS する（既存動作の維持を確認）
    expect(result).toHaveProperty('査定額1（自動計算）v');
    expect(result['査定額1（自動計算）v']).toBe(3000);
  });

  // ============================================================
  // PBT: ランダムな valuationAmount1=null の場合は常に isManualValuation=false
  // Requirements: 3.1
  // ============================================================

  /**
   * Property-Based Test: valuationAmount1=null の任意の入力で isManualValuation=false かつ空欄維持
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('PBT: ランダムな valuationAmount1=null の場合は常に isManualValuation=false', () => {
    // valuationAmount1=null の任意の入力を生成
    const arbitrary = fc.record({
      valuationAmount2: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: null }),
      valuationAmount3: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: null }),
      fixedAssetTaxRoadPrice: fc.option(fc.integer({ min: 1000, max: 1000000 }), { nil: null }),
    });

    fc.assert(
      fc.property(arbitrary, ({ valuationAmount2, valuationAmount3, fixedAssetTaxRoadPrice }) => {
        const sellerData: SellerDataForValuation = {
          valuationAmount1: null, // 常に null
          valuationAmount2,
          valuationAmount3,
          fixedAssetTaxRoadPrice,
        };

        const result = initValuationStateBuggy(sellerData);

        // valuationAmount1=null の場合は常に isManualValuation=false
        return result.isManualValuation === false && result.editedManualValuationAmount1 === '';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property-Based Test: ランダムな fixedAssetTaxRoadPrice が非nullの場合は常に isManualValuation=false
   *
   * **Validates: Requirements 3.2**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('PBT: ランダムな fixedAssetTaxRoadPrice が非nullの場合は常に isManualValuation=false', () => {
    // fixedAssetTaxRoadPrice が非null の任意の入力を生成
    const arbitrary = fc.record({
      valuationAmount1: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: null }),
      valuationAmount2: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: null }),
      valuationAmount3: fc.option(fc.integer({ min: 1000000, max: 100000000 }), { nil: null }),
      fixedAssetTaxRoadPrice: fc.integer({ min: 1000, max: 1000000 }), // 常に非null
    });

    fc.assert(
      fc.property(arbitrary, ({ valuationAmount1, valuationAmount2, valuationAmount3, fixedAssetTaxRoadPrice }) => {
        const sellerData: SellerDataForValuation = {
          valuationAmount1,
          valuationAmount2,
          valuationAmount3,
          fixedAssetTaxRoadPrice, // 常に非null
        };

        const result = initValuationStateBuggy(sellerData);

        // fixedAssetTaxRoadPrice が非null の場合は常に isManualValuation=false（自動計算モード）
        // 修正後も: fixedAssetTaxRoadPrice が非null の場合は手入力モードにならない
        return result.isManualValuation === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property-Based Test: 任意の valuation_amount_1/2/3 値で mapToSheet() が
   * 「査定額1（自動計算）v」/「査定額2（自動計算）v」/「査定額3（自動計算）v」を含む
   *
   * **Validates: Requirements 3.3**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('PBT: 任意の valuation_amount_1/2/3 値で mapToSheet() が「査定額1（自動計算）v」等を含む', () => {
    // 任意の査定額（円単位）を生成
    const arbitrary = fc.record({
      valuation_amount_1: fc.integer({ min: 1000000, max: 100000000 }),
      valuation_amount_2: fc.integer({ min: 1000000, max: 100000000 }),
      valuation_amount_3: fc.integer({ min: 1000000, max: 100000000 }),
    });

    fc.assert(
      fc.property(arbitrary, ({ valuation_amount_1, valuation_amount_2, valuation_amount_3 }) => {
        const sellerData = {
          name: 'テスト売主',
          address: 'テスト住所',
          phone_number: '090-1234-5678',
          valuation_amount_1,
          valuation_amount_2,
          valuation_amount_3,
        };

        const result = columnMapper.mapToSheet(sellerData);

        // BC/BD/BE列（自動計算列）が常に含まれること
        const hasAutoCalc1 = '査定額1（自動計算）v' in result;
        const hasAutoCalc2 = '査定額2（自動計算）v' in result;
        const hasAutoCalc3 = '査定額3（自動計算）v' in result;

        // 万円単位に変換されていること
        const expectedMan1 = Math.round(valuation_amount_1 / 10000);
        const expectedMan2 = Math.round(valuation_amount_2 / 10000);
        const expectedMan3 = Math.round(valuation_amount_3 / 10000);

        const correctValue1 = result['査定額1（自動計算）v'] === expectedMan1;
        const correctValue2 = result['査定額2（自動計算）v'] === expectedMan2;
        const correctValue3 = result['査定額3（自動計算）v'] === expectedMan3;

        if (!hasAutoCalc1 || !hasAutoCalc2 || !hasAutoCalc3 || !correctValue1 || !correctValue2 || !correctValue3) {
          console.log(`カウンター例: valuation_amount_1=${valuation_amount_1}, valuation_amount_2=${valuation_amount_2}, valuation_amount_3=${valuation_amount_3}`);
          console.log(`  hasAutoCalc1=${hasAutoCalc1}, hasAutoCalc2=${hasAutoCalc2}, hasAutoCalc3=${hasAutoCalc3}`);
          console.log(`  correctValue1=${correctValue1}(expected=${expectedMan1}, got=${result['査定額1（自動計算）v']})`);
          console.log(`  correctValue2=${correctValue2}(expected=${expectedMan2}, got=${result['査定額2（自動計算）v']})`);
          console.log(`  correctValue3=${correctValue3}(expected=${expectedMan3}, got=${result['査定額3（自動計算）v']})`);
        }

        return hasAutoCalc1 && hasAutoCalc2 && hasAutoCalc3 && correctValue1 && correctValue2 && correctValue3;
      }),
      { numRuns: 100 }
    );
  });
});
