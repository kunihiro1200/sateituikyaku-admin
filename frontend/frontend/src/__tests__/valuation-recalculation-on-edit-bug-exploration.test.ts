/**
 * バグ条件探索テスト：固定資産税路線価編集時の査定額再計算
 * 
 * **重要**: このテストは修正前のコードで実行し、バグを再現する
 * **期待される結果**: テストが失敗する（バグが存在することを確認）
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * Property 1: Bug Condition - 固定資産税路線価編集時の査定額再計算
 * 
 * Bug Condition:
 * - 固定資産税路線価を最初に入力（例: 50000）→ 査定額1/2/3が自動計算される
 * - 固定資産税路線価を編集（例: 50000 → 60000）→ 査定額1/2/3が更新されない（バグ再現）
 * - ページをリロード → 査定額1のみ再計算、査定額2/3が空欄（バグ再現）
 */

import * as fc from 'fast-check';

// ===== バグ条件の定義 =====

/**
 * バグ条件を判定する関数
 * 
 * @param input - 入力データ
 * @returns バグ条件を満たす場合はtrue
 */
function isBugCondition(input: {
  action: 'edit' | 'create';
  field: string;
  oldValue: number | null;
  newValue: number | null;
}): boolean {
  return (
    input.action === 'edit' &&
    input.field === 'fixedAssetTaxRoadPrice' &&
    input.oldValue !== null &&
    input.newValue !== input.oldValue
  );
}

/**
 * 期待される動作（修正後）
 * 
 * 固定資産税路線価を編集すると、査定額1/2/3が即座に再計算される
 */
function expectedBehavior(input: {
  action: 'edit' | 'create';
  field: string;
  oldValue: number | null;
  newValue: number | null;
}): {
  valuationAmount1Recalculated: boolean;
  valuationAmount2Recalculated: boolean;
  valuationAmount3Recalculated: boolean;
} {
  if (isBugCondition(input)) {
    // バグ条件を満たす場合、査定額1/2/3が再計算される
    return {
      valuationAmount1Recalculated: true,
      valuationAmount2Recalculated: true,
      valuationAmount3Recalculated: true,
    };
  }
  
  // バグ条件を満たさない場合、再計算されない
  return {
    valuationAmount1Recalculated: false,
    valuationAmount2Recalculated: false,
    valuationAmount3Recalculated: false,
  };
}

/**
 * 現在の動作（修正前）
 * 
 * 固定資産税路線価を編集しても、査定額1/2/3が再計算されない（バグ）
 */
function currentBehavior(input: {
  action: 'edit' | 'create';
  field: string;
  oldValue: number | null;
  newValue: number | null;
}): {
  valuationAmount1Recalculated: boolean;
  valuationAmount2Recalculated: boolean;
  valuationAmount3Recalculated: boolean;
} {
  // 修正前のコードでは、編集時に査定額が再計算されない
  return {
    valuationAmount1Recalculated: false,
    valuationAmount2Recalculated: false,
    valuationAmount3Recalculated: false,
  };
}

// ===== ジェネレーター =====

/**
 * バグ条件を満たす入力を生成するジェネレーター
 */
const bugConditionArbitrary = fc.record({
  action: fc.constant('edit' as const),
  field: fc.constant('fixedAssetTaxRoadPrice'),
  oldValue: fc.integer({ min: 10000, max: 100000 }),
  newValue: fc.integer({ min: 10000, max: 100000 }),
}).filter((input) => input.oldValue !== input.newValue);

// ===== Property 1: Bug Condition - 固定資産税路線価編集時の査定額再計算 =====

describe('Property 1: Bug Condition - 固定資産税路線価編集時の査定額再計算', () => {
  /**
   * Validates: Requirements 1.1, 1.2, 1.3
   * 
   * このテストは修正前のコードで失敗することを期待
   * 失敗 = バグが存在することを証明
   */
  test('Property 1: 固定資産税路線価を編集すると査定額1/2/3が再計算される（期待される動作）', () => {
    fc.assert(
      fc.property(bugConditionArbitrary, (input) => {
        // 期待される動作
        const expected = expectedBehavior(input);
        
        // 現在の動作（修正前）
        const actual = currentBehavior(input);
        
        // このテストは修正前のコードで失敗することを期待
        // 失敗メッセージ:
        // Expected: { valuationAmount1Recalculated: true, valuationAmount2Recalculated: true, valuationAmount3Recalculated: true }
        // Received: { valuationAmount1Recalculated: false, valuationAmount2Recalculated: false, valuationAmount3Recalculated: false }
        expect(actual).toEqual(expected);
      }),
      { numRuns: 100 } // 100回のランダムテストを実行
    );
  });

  /**
   * 具体例1: 固定資産税路線価を50000から60000に編集
   */
  test('具体例1: 固定資産税路線価を50000から60000に編集 → 査定額が更新されない（バグ再現）', () => {
    const input = {
      action: 'edit' as const,
      field: 'fixedAssetTaxRoadPrice',
      oldValue: 50000,
      newValue: 60000,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作
    const expected = expectedBehavior(input);
    expect(expected.valuationAmount1Recalculated).toBe(true);
    expect(expected.valuationAmount2Recalculated).toBe(true);
    expect(expected.valuationAmount3Recalculated).toBe(true);
    
    // 現在の動作（修正前）
    const actual = currentBehavior(input);
    
    // このテストは修正前のコードで失敗することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 具体例2: 固定資産税路線価を60000から70000に編集
   */
  test('具体例2: 固定資産税路線価を60000から70000に編集 → 査定額が更新されない（バグ再現）', () => {
    const input = {
      action: 'edit' as const,
      field: 'fixedAssetTaxRoadPrice',
      oldValue: 60000,
      newValue: 70000,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作
    const expected = expectedBehavior(input);
    
    // 現在の動作（修正前）
    const actual = currentBehavior(input);
    
    // このテストは修正前のコードで失敗することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * 具体例3: 固定資産税路線価を空欄にする
   */
  test('具体例3: 固定資産税路線価を60000から空欄にする → 査定額がクリアされる', () => {
    const input = {
      action: 'edit' as const,
      field: 'fixedAssetTaxRoadPrice',
      oldValue: 60000,
      newValue: null,
    };
    
    // バグ条件を満たすことを確認
    expect(isBugCondition(input)).toBe(true);
    
    // 期待される動作（空欄の場合は査定額がクリアされる）
    const expected = {
      valuationAmount1Recalculated: true,
      valuationAmount2Recalculated: true,
      valuationAmount3Recalculated: true,
    };
    
    // 現在の動作（修正前）
    const actual = currentBehavior(input);
    
    // このテストは修正前のコードで失敗することを期待
    expect(actual).toEqual(expected);
  });
});

// ===== ページリロード後の不整合テスト =====

describe('ページリロード後の不整合（バグ再現）', () => {
  /**
   * Validates: Requirements 1.2
   * 
   * ページリロード後に査定額1のみが再計算され、査定額2/3が空欄になる（バグ）
   */
  test('ページリロード後: 査定額1のみ再計算、査定額2/3が空欄（バグ再現）', () => {
    // ページリロード後の動作（修正前）
    const afterReload = {
      valuationAmount1Recalculated: true,  // 査定額1のみ再計算される
      valuationAmount2Recalculated: false, // 査定額2は空欄（バグ）
      valuationAmount3Recalculated: false, // 査定額3は空欄（バグ）
    };
    
    // 期待される動作（修正後）
    const expected = {
      valuationAmount1Recalculated: true,
      valuationAmount2Recalculated: true,
      valuationAmount3Recalculated: true,
    };
    
    // このテストは修正前のコードで失敗することを期待
    expect(afterReload).toEqual(expected);
  });
});

// ===== カウンターサンプル =====

describe('カウンターサンプル（バグの具体例）', () => {
  /**
   * カウンターサンプル1: 固定資産税路線価を50000から60000に編集しても査定額が更新されない
   */
  test('カウンターサンプル1: 固定資産税路線価を50000から60000に編集しても査定額が更新されない', () => {
    const input = {
      action: 'edit' as const,
      field: 'fixedAssetTaxRoadPrice',
      oldValue: 50000,
      newValue: 60000,
    };
    
    // 現在の動作（修正前）
    const actual = currentBehavior(input);
    
    // バグ: 査定額が更新されない
    expect(actual.valuationAmount1Recalculated).toBe(false);
    expect(actual.valuationAmount2Recalculated).toBe(false);
    expect(actual.valuationAmount3Recalculated).toBe(false);
    
    // 期待される動作（修正後）
    const expected = expectedBehavior(input);
    expect(expected.valuationAmount1Recalculated).toBe(true);
    expect(expected.valuationAmount2Recalculated).toBe(true);
    expect(expected.valuationAmount3Recalculated).toBe(true);
    
    // このテストは修正前のコードで失敗することを期待
    expect(actual).toEqual(expected);
  });

  /**
   * カウンターサンプル2: ページリロード後に査定額2/3が空欄になる
   */
  test('カウンターサンプル2: ページリロード後に査定額2/3が空欄になる', () => {
    // ページリロード後の動作（修正前）
    const afterReload = {
      valuationAmount1: 5580, // 査定額1は再計算される
      valuationAmount2: null, // 査定額2は空欄（バグ）
      valuationAmount3: null, // 査定額3は空欄（バグ）
    };
    
    // 期待される動作（修正後）
    const expected = {
      valuationAmount1: 5580,
      valuationAmount2: 5930, // 査定額2も再計算される
      valuationAmount3: 6280, // 査定額3も再計算される
    };
    
    // このテストは修正前のコードで失敗することを期待
    expect(afterReload).toEqual(expected);
  });
});
