/**
 * バグ条件探索テスト：査定額同期先列の間違い
 * 
 * **重要**: このテストは修正前のコードで実行し、失敗することを確認する（失敗がバグの存在を証明）
 * **修正後は実行しない** - このテストは探索用であり、修正後の検証には使用しない
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * Bug Condition:
 * - column-mapping.jsonのdatabaseToSpreadsheetセクションで、
 *   valuation_amount_1/2/3が「査定額1/2/3」（CB/CC/CD列）にマッピングされている
 * 
 * Expected Behavior (修正後):
 * - valuation_amount_1/2/3が「査定額1（自動計算）v/査定額2（自動計算）v/査定額3（自動計算）v」
 *   （BC/BD/BE列）にマッピングされる
 */

import columnMapping from '../config/column-mapping.json';

describe('Bug Condition Exploration: 査定額同期先列の間違い', () => {
  it('should detect incorrect mapping for valuation_amount_1 (Bug Condition)', () => {
    // 現在のマッピングを取得
    const mapping = columnMapping.databaseToSpreadsheet;
    
    // バグ条件: valuation_amount_1が「査定額1」にマッピングされている
    // 期待される正しい値: 「査定額1（自動計算）v」
    
    // このテストは修正前のコードで失敗することを期待
    // 失敗 = バグが存在することを証明
    expect(mapping.valuation_amount_1).toBe('査定額1（自動計算）v');
    
    // 実際の値（修正前）: 「査定額1」
    // このテストが失敗した場合、以下のメッセージが表示される:
    // Expected: "査定額1（自動計算）v"
    // Received: "査定額1"
  });

  it('should detect incorrect mapping for valuation_amount_2 (Bug Condition)', () => {
    const mapping = columnMapping.databaseToSpreadsheet;
    
    // バグ条件: valuation_amount_2が「査定額2」にマッピングされている
    // 期待される正しい値: 「査定額2（自動計算）v」
    expect(mapping.valuation_amount_2).toBe('査定額2（自動計算）v');
  });

  it('should detect incorrect mapping for valuation_amount_3 (Bug Condition)', () => {
    const mapping = columnMapping.databaseToSpreadsheet;
    
    // バグ条件: valuation_amount_3が「査定額3」にマッピングされている
    // 期待される正しい値: 「査定額3（自動計算）v」
    expect(mapping.valuation_amount_3).toBe('査定額3（自動計算）v');
  });

  it('should verify all three valuation fields are incorrectly mapped (Bug Condition)', () => {
    const mapping = columnMapping.databaseToSpreadsheet;
    
    // 3つの査定額フィールド全てが間違った列にマッピングされていることを確認
    const expectedMappings = {
      valuation_amount_1: '査定額1（自動計算）v',
      valuation_amount_2: '査定額2（自動計算）v',
      valuation_amount_3: '査定額3（自動計算）v',
    };
    
    // 実際のマッピング（修正前）
    const actualMappings = {
      valuation_amount_1: mapping.valuation_amount_1,
      valuation_amount_2: mapping.valuation_amount_2,
      valuation_amount_3: mapping.valuation_amount_3,
    };
    
    // このテストは修正前のコードで失敗することを期待
    expect(actualMappings).toEqual(expectedMappings);
  });
});
