/**
 * バグ条件探索テスト: 手入力査定額保存バグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * このテストは修正前のコードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 *
 * バグ1: loadAllData() 内で setIsManualValuation(false) が無条件実行される
 *   - valuationAmount1=30000000, fixedAssetTaxRoadPrice=null のデータで
 *     isManualValuation が false のままになる（手入力値がリセットされる）
 *
 * バグ2: ColumnMapper.mapToSheet() で査定額1/2/3（CB/CC/CD列）へのマッピングが存在しない
 *   - valuation_amount_1=30000000 のデータで mapToSheet() を呼び出しても
 *     返り値に「査定額1」キーが存在しない
 */

import { ColumnMapper } from '../services/ColumnMapper';

// ============================================================
// バグ2テスト: ColumnMapper.mapToSheet() の査定額マッピング欠落
// ============================================================

describe('Bug Condition Exploration: 手入力査定額保存バグ', () => {
  let columnMapper: ColumnMapper;

  beforeEach(() => {
    columnMapper = new ColumnMapper();
  });

  /**
   * バグ2テスト: mapToSheet() に「査定額1」キーが存在しない
   *
   * **Validates: Requirements 1.3, 1.4**
   *
   * バグ条件:
   * - column-mapping.json の databaseToSpreadsheet に
   *   valuation_amount_1 → 査定額1（CB列）のマッピングが存在しない
   *
   * 修正前: 返り値に「査定額1」キーが存在しない → テスト FAIL（バグ確認）
   * 修正後: 返り値に「査定額1」キーが存在する → テスト PASS
   */
  test('バグ2: valuation_amount_1=30000000 で mapToSheet() を呼び出すと「査定額1」キーが存在しない（バグ確認）', () => {
    // Arrange: 手入力査定額が保存されたデータ（valuation_amount_1=30000000円）
    const sellerData = {
      name: 'テスト売主',
      address: 'テスト住所',
      phone_number: '090-1234-5678',
      valuation_amount_1: 30000000, // 3000万円（円単位）
      valuation_amount_2: null,
      valuation_amount_3: null,
    };

    // Act: mapToSheet() を呼び出す
    const result = columnMapper.mapToSheet(sellerData);

    console.log('mapToSheet() の返り値のキー一覧:', Object.keys(result));
    console.log('「査定額1（自動計算）v」の値:', result['査定額1（自動計算）v']);
    console.log('「査定額1」の値:', result['査定額1']);

    // Assert: 「査定額1」キーが存在することを確認
    // 修正前: 「査定額1」キーが存在しない → テスト FAIL（バグの存在を証明）
    // 修正後: 「査定額1」キーが存在し、値が 3000（万円単位）になる → テスト PASS
    expect(result).toHaveProperty('査定額1');
    expect(result['査定額1']).toBe(3000);
  });

  /**
   * バグ2テスト: mapToSheet() に「査定額2」キーが存在しない
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  test('バグ2: valuation_amount_2=35000000 で mapToSheet() を呼び出すと「査定額2」キーが存在しない（バグ確認）', () => {
    // Arrange
    const sellerData = {
      name: 'テスト売主',
      address: 'テスト住所',
      phone_number: '090-1234-5678',
      valuation_amount_1: 30000000,
      valuation_amount_2: 35000000, // 3500万円（円単位）
      valuation_amount_3: null,
    };

    // Act
    const result = columnMapper.mapToSheet(sellerData);

    console.log('「査定額2（自動計算）v」の値:', result['査定額2（自動計算）v']);
    console.log('「査定額2」の値:', result['査定額2']);

    // Assert: 「査定額2」キーが存在することを確認
    // 修正前: 「査定額2」キーが存在しない → テスト FAIL（バグの存在を証明）
    expect(result).toHaveProperty('査定額2');
    expect(result['査定額2']).toBe(3500);
  });

  /**
   * バグ2テスト: mapToSheet() に「査定額3」キーが存在しない
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  test('バグ2: valuation_amount_3=40000000 で mapToSheet() を呼び出すと「査定額3」キーが存在しない（バグ確認）', () => {
    // Arrange
    const sellerData = {
      name: 'テスト売主',
      address: 'テスト住所',
      phone_number: '090-1234-5678',
      valuation_amount_1: 30000000,
      valuation_amount_2: 35000000,
      valuation_amount_3: 40000000, // 4000万円（円単位）
    };

    // Act
    const result = columnMapper.mapToSheet(sellerData);

    console.log('「査定額3（自動計算）v」の値:', result['査定額3（自動計算）v']);
    console.log('「査定額3」の値:', result['査定額3']);

    // Assert: 「査定額3」キーが存在することを確認
    // 修正前: 「査定額3」キーが存在しない → テスト FAIL（バグの存在を証明）
    expect(result).toHaveProperty('査定額3');
    expect(result['査定額3']).toBe(4000);
  });

  /**
   * 保全確認: 「査定額1（自動計算）v」は引き続き存在する
   *
   * **Validates: Requirements 3.3**
   *
   * このテストは修正前後ともに PASS する（既存動作の維持を確認）
   */
  test('保全確認: valuation_amount_1=30000000 で mapToSheet() を呼び出すと「査定額1（自動計算）v」が存在する', () => {
    // Arrange
    const sellerData = {
      name: 'テスト売主',
      address: 'テスト住所',
      phone_number: '090-1234-5678',
      valuation_amount_1: 30000000,
    };

    // Act
    const result = columnMapper.mapToSheet(sellerData);

    console.log('「査定額1（自動計算）v」の値:', result['査定額1（自動計算）v']);

    // Assert: 「査定額1（自動計算）v」キーが存在し、値が 3000（万円単位）になる
    // このテストは修正前後ともに PASS する（既存動作の維持を確認）
    expect(result).toHaveProperty('査定額1（自動計算）v');
    expect(result['査定額1（自動計算）v']).toBe(3000);
  });
});
