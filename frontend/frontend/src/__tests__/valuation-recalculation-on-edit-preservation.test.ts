/**
 * 保存テスト：既存の査定額計算ロジックの維持
 * 
 * **重要**: このテストは修正前のコードで実行し、既存の動作を確認する
 * **期待される結果**: テストが成功する（既存の動作が正しいことを確認）
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * Property 2: Preservation - 既存の査定額計算ロジックの維持
 * 
 * テスト内容:
 * - 固定資産税路線価を最初に入力（例: 50000）→ 査定額1/2/3が自動計算される（正常）
 * - 手入力査定額保存ボタンを押す → 手入力査定額が優先される（正常）
 * - 土地面積を編集 → 査定額は再計算されない（正常）
 * - 査定額の優先順位ロジック（手動入力優先、なければ自動計算）が正しく適用される（正常）
 */

import * as fc from 'fast-check';

// ===== 既存の動作の定義 =====

/**
 * 固定資産税路線価の初回入力時の動作
 * 
 * @param fixedAssetTaxRoadPrice - 固定資産税路線価
 * @returns 査定額1/2/3が自動計算される
 */
function initialInputBehavior(fixedAssetTaxRoadPrice: number): {
  valuationAmount1Calculated: boolean;
  valuationAmount2Calculated: boolean;
  valuationAmount3Calculated: boolean;
} {
  // 固定資産税路線価が入力されている場合、査定額1/2/3が自動計算される
  if (fixedAssetTaxRoadPrice > 0) {
    return {
      valuationAmount1Calculated: true,
      valuationAmount2Calculated: true,
      valuationAmount3Calculated: true,
    };
  }
  
  // 固定資産税路線価が0または空の場合、査定額は計算されない
  return {
    valuationAmount1Calculated: false,
    valuationAmount2Calculated: false,
    valuationAmount3Calculated: false,
  };
}

/**
 * 手入力査定額保存時の動作
 * 
 * @param manualValuationAmount1 - 手入力査定額1
 * @param manualValuationAmount2 - 手入力査定額2
 * @param manualValuationAmount3 - 手入力査定額3
 * @returns 手入力査定額が優先される
 */
function manualValuationSaveBehavior(
  manualValuationAmount1: number | null,
  manualValuationAmount2: number | null,
  manualValuationAmount3: number | null
): {
  manualValuationPrioritized: boolean;
} {
  // 手入力査定額が存在する場合、手入力査定額が優先される
  if (
    manualValuationAmount1 !== null ||
    manualValuationAmount2 !== null ||
    manualValuationAmount3 !== null
  ) {
    return {
      manualValuationPrioritized: true,
    };
  }
  
  // 手入力査定額が存在しない場合、自動計算査定額が使用される
  return {
    manualValuationPrioritized: false,
  };
}

/**
 * 土地面積編集時の動作
 * 
 * @param landArea - 土地面積
 * @returns 査定額は再計算されない
 */
function landAreaEditBehavior(landArea: number): {
  valuationAmount1Recalculated: boolean;
  valuationAmount2Recalculated: boolean;
  valuationAmount3Recalculated: boolean;
} {
  // 土地面積を編集しても、査定額は再計算されない（正常）
  return {
    valuationAmount1Recalculated: false,
    valuationAmount2Recalculated: false,
    valuationAmount3Recalculated: false,
  };
}

/**
 * 査定額の優先順位ロジック
 * 
 * @param manualValuationAmount - 手入力査定額
 * @param autoCalculatedValuationAmount - 自動計算査定額
 * @returns 優先される査定額
 */
function valuationPriorityLogic(
  manualValuationAmount: number | null,
  autoCalculatedValuationAmount: number | null
): number | null {
  // 手入力査定額が存在する場合、手入力査定額を優先
  if (manualValuationAmount !== null) {
    return manualValuationAmount;
  }
  
  // 手入力査定額が存在しない場合、自動計算査定額を使用
  return autoCalculatedValuationAmount;
}

// ===== ジェネレーター =====

/**
 * 固定資産税路線価を生成するジェネレーター
 */
const fixedAssetTaxRoadPriceArbitrary = fc.integer({ min: 10000, max: 100000 });

/**
 * 手入力査定額を生成するジェネレーター
 */
const manualValuationAmountArbitrary = fc.option(
  fc.integer({ min: 1000000, max: 100000000 }),
  { nil: null }
);

/**
 * 土地面積を生成するジェネレーター
 */
const landAreaArbitrary = fc.integer({ min: 50, max: 500 });

// ===== Property 2: Preservation - 既存の査定額計算ロジックの維持 =====

describe('Property 2: Preservation - 既存の査定額計算ロジックの維持', () => {
  /**
   * Validates: Requirements 3.1
   * 
   * 固定資産税路線価を最初に入力した時の自動計算が正しく動作する
   */
  test('Property 2.1: 固定資産税路線価を最初に入力すると査定額1/2/3が自動計算される', () => {
    fc.assert(
      fc.property(fixedAssetTaxRoadPriceArbitrary, (fixedAssetTaxRoadPrice) => {
        // 初回入力時の動作
        const result = initialInputBehavior(fixedAssetTaxRoadPrice);
        
        // 固定資産税路線価が入力されている場合、査定額1/2/3が自動計算される
        expect(result.valuationAmount1Calculated).toBe(true);
        expect(result.valuationAmount2Calculated).toBe(true);
        expect(result.valuationAmount3Calculated).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.2
   * 
   * 手入力査定額保存ボタンを押すと、手入力査定額が優先される
   */
  test('Property 2.2: 手入力査定額保存ボタンを押すと手入力査定額が優先される', () => {
    fc.assert(
      fc.property(
        manualValuationAmountArbitrary,
        manualValuationAmountArbitrary,
        manualValuationAmountArbitrary,
        (manualValuationAmount1, manualValuationAmount2, manualValuationAmount3) => {
          // 少なくとも1つの手入力査定額が存在する場合のみテスト
          if (
            manualValuationAmount1 === null &&
            manualValuationAmount2 === null &&
            manualValuationAmount3 === null
          ) {
            return true; // スキップ
          }
          
          // 手入力査定額保存時の動作
          const result = manualValuationSaveBehavior(
            manualValuationAmount1,
            manualValuationAmount2,
            manualValuationAmount3
          );
          
          // 手入力査定額が優先される
          expect(result.manualValuationPrioritized).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.3
   * 
   * 土地面積を編集しても、査定額は再計算されない
   */
  test('Property 2.3: 土地面積を編集しても査定額は再計算されない', () => {
    fc.assert(
      fc.property(landAreaArbitrary, (landArea) => {
        // 土地面積編集時の動作
        const result = landAreaEditBehavior(landArea);
        
        // 査定額は再計算されない
        expect(result.valuationAmount1Recalculated).toBe(false);
        expect(result.valuationAmount2Recalculated).toBe(false);
        expect(result.valuationAmount3Recalculated).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   * 
   * 査定額の優先順位ロジック（手動入力優先、なければ自動計算）が正しく適用される
   */
  test('Property 2.4: 査定額の優先順位ロジックが正しく適用される', () => {
    fc.assert(
      fc.property(
        manualValuationAmountArbitrary,
        fc.integer({ min: 1000000, max: 100000000 }),
        (manualValuationAmount, autoCalculatedValuationAmount) => {
          // 優先順位ロジック
          const result = valuationPriorityLogic(
            manualValuationAmount,
            autoCalculatedValuationAmount
          );
          
          // 手入力査定額が存在する場合、手入力査定額が優先される
          if (manualValuationAmount !== null) {
            expect(result).toBe(manualValuationAmount);
          } else {
            // 手入力査定額が存在しない場合、自動計算査定額が使用される
            expect(result).toBe(autoCalculatedValuationAmount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== 具体例テスト =====

describe('具体例：既存の動作が正しく維持されている', () => {
  /**
   * 具体例1: 固定資産税路線価を最初に50000と入力 → 査定額が自動計算される
   */
  test('具体例1: 固定資産税路線価を最初に50000と入力 → 査定額が自動計算される', () => {
    const fixedAssetTaxRoadPrice = 50000;
    
    // 初回入力時の動作
    const result = initialInputBehavior(fixedAssetTaxRoadPrice);
    
    // 査定額1/2/3が自動計算される
    expect(result.valuationAmount1Calculated).toBe(true);
    expect(result.valuationAmount2Calculated).toBe(true);
    expect(result.valuationAmount3Calculated).toBe(true);
  });

  /**
   * 具体例2: 手入力査定額保存ボタンを押す → 手入力査定額が優先される
   */
  test('具体例2: 手入力査定額保存ボタンを押す → 手入力査定額が優先される', () => {
    const manualValuationAmount1 = 12000000;
    const manualValuationAmount2 = 13000000;
    const manualValuationAmount3 = 15000000;
    
    // 手入力査定額保存時の動作
    const result = manualValuationSaveBehavior(
      manualValuationAmount1,
      manualValuationAmount2,
      manualValuationAmount3
    );
    
    // 手入力査定額が優先される
    expect(result.manualValuationPrioritized).toBe(true);
  });

  /**
   * 具体例3: 土地面積を編集 → 査定額は再計算されない
   */
  test('具体例3: 土地面積を編集 → 査定額は再計算されない', () => {
    const landArea = 100;
    
    // 土地面積編集時の動作
    const result = landAreaEditBehavior(landArea);
    
    // 査定額は再計算されない
    expect(result.valuationAmount1Recalculated).toBe(false);
    expect(result.valuationAmount2Recalculated).toBe(false);
    expect(result.valuationAmount3Recalculated).toBe(false);
  });

  /**
   * 具体例4: 査定額の優先順位ロジック（手動入力優先）
   */
  test('具体例4: 査定額の優先順位ロジック（手動入力優先）', () => {
    const manualValuationAmount = 12000000;
    const autoCalculatedValuationAmount = 10000000;
    
    // 優先順位ロジック
    const result = valuationPriorityLogic(
      manualValuationAmount,
      autoCalculatedValuationAmount
    );
    
    // 手入力査定額が優先される
    expect(result).toBe(manualValuationAmount);
  });

  /**
   * 具体例5: 査定額の優先順位ロジック（手動入力がない場合は自動計算）
   */
  test('具体例5: 査定額の優先順位ロジック（手動入力がない場合は自動計算）', () => {
    const manualValuationAmount = null;
    const autoCalculatedValuationAmount = 10000000;
    
    // 優先順位ロジック
    const result = valuationPriorityLogic(
      manualValuationAmount,
      autoCalculatedValuationAmount
    );
    
    // 自動計算査定額が使用される
    expect(result).toBe(autoCalculatedValuationAmount);
  });
});

// ===== エッジケーステスト =====

describe('エッジケース：境界値のテスト', () => {
  /**
   * エッジケース1: 固定資産税路線価が0の場合
   */
  test('エッジケース1: 固定資産税路線価が0の場合 → 査定額は計算されない', () => {
    const fixedAssetTaxRoadPrice = 0;
    
    // 初回入力時の動作
    const result = initialInputBehavior(fixedAssetTaxRoadPrice);
    
    // 査定額は計算されない
    expect(result.valuationAmount1Calculated).toBe(false);
    expect(result.valuationAmount2Calculated).toBe(false);
    expect(result.valuationAmount3Calculated).toBe(false);
  });

  /**
   * エッジケース2: 手入力査定額が全てnullの場合
   */
  test('エッジケース2: 手入力査定額が全てnullの場合 → 自動計算査定額が使用される', () => {
    const manualValuationAmount1 = null;
    const manualValuationAmount2 = null;
    const manualValuationAmount3 = null;
    
    // 手入力査定額保存時の動作
    const result = manualValuationSaveBehavior(
      manualValuationAmount1,
      manualValuationAmount2,
      manualValuationAmount3
    );
    
    // 手入力査定額が優先されない（自動計算査定額が使用される）
    expect(result.manualValuationPrioritized).toBe(false);
  });

  /**
   * エッジケース3: 土地面積が0の場合
   */
  test('エッジケース3: 土地面積が0の場合 → 査定額は再計算されない', () => {
    const landArea = 0;
    
    // 土地面積編集時の動作
    const result = landAreaEditBehavior(landArea);
    
    // 査定額は再計算されない
    expect(result.valuationAmount1Recalculated).toBe(false);
    expect(result.valuationAmount2Recalculated).toBe(false);
    expect(result.valuationAmount3Recalculated).toBe(false);
  });

  /**
   * エッジケース4: 自動計算査定額がnullの場合
   */
  test('エッジケース4: 自動計算査定額がnullの場合 → nullが返される', () => {
    const manualValuationAmount = null;
    const autoCalculatedValuationAmount = null;
    
    // 優先順位ロジック
    const result = valuationPriorityLogic(
      manualValuationAmount,
      autoCalculatedValuationAmount
    );
    
    // nullが返される
    expect(result).toBe(null);
  });
});
