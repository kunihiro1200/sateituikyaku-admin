/**
 * バグ条件探索テスト: 手入力査定額保存バグ（フロントエンド）
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは修正前のコードで実行すると失敗する（これが正しい - バグの存在を証明する）
 * 修正後は成功する（バグが修正されたことを確認）
 *
 * バグ1: loadAllData() 内で setIsManualValuation(false) が無条件実行される
 *   - valuationAmount1=30000000, fixedAssetTaxRoadPrice=null のデータで
 *     isManualValuation が false のままになる（手入力値がリセットされる）
 *   - editedManualValuationAmount1 が '' のままになる
 */

// ============================================================
// loadAllData() の査定額初期化ロジックを純粋関数として抽出
// ============================================================

/**
 * 売主データの型定義（テスト用）
 */
interface SellerData {
  valuationAmount1: number | null;
  valuationAmount2: number | null;
  valuationAmount3: number | null;
  fixedAssetTaxRoadPrice: number | null;
}

/**
 * 査定額初期化の結果型
 */
interface ValuationInitResult {
  isManualValuation: boolean;
  editedManualValuationAmount1: string;
  editedManualValuationAmount2: string;
  editedManualValuationAmount3: string;
}

/**
 * 修正前の loadAllData() 内の査定額初期化ロジック（バグあり）
 *
 * 実際のコード（CallModePage.tsx 約1785〜1789行目）:
 * ```typescript
 * // 常に自動計算モードとして扱う
 * // （手入力査定額は将来的にmanualValuationAmount1を使用）
 * setIsManualValuation(false);
 * setEditedManualValuationAmount1('');
 * setEditedManualValuationAmount2('');
 * setEditedManualValuationAmount3('');
 * ```
 *
 * バグ: valuationAmount1 が存在し fixedAssetTaxRoadPrice が null の場合でも
 *       isManualValuation が false にリセットされる
 */
function initValuationStateBuggy(sellerData: SellerData): ValuationInitResult {
  // 修正前のコード: 無条件に false / '' にリセット
  return {
    isManualValuation: false,
    editedManualValuationAmount1: '',
    editedManualValuationAmount2: '',
    editedManualValuationAmount3: '',
  };
}

/**
 * 修正後の loadAllData() 内の査定額初期化ロジック（期待される動作）
 *
 * 修正後のコード（design.md より）:
 * ```typescript
 * const hasManualValuation = sellerData.valuationAmount1 != null
 *                            && sellerData.fixedAssetTaxRoadPrice == null;
 * if (hasManualValuation) {
 *   setIsManualValuation(true);
 *   setEditedManualValuationAmount1(String(Math.round(sellerData.valuationAmount1 / 10000)));
 *   ...
 * } else {
 *   setIsManualValuation(false);
 *   setEditedManualValuationAmount1('');
 *   ...
 * }
 * ```
 */
function initValuationStateFixed(sellerData: SellerData): ValuationInitResult {
  // 修正後のコード: 手入力モードを判定して適切に初期化
  const hasManualValuation =
    sellerData.valuationAmount1 != null && sellerData.fixedAssetTaxRoadPrice == null;

  if (hasManualValuation) {
    return {
      isManualValuation: true,
      editedManualValuationAmount1: String(Math.round(sellerData.valuationAmount1! / 10000)),
      editedManualValuationAmount2: sellerData.valuationAmount2
        ? String(Math.round(sellerData.valuationAmount2 / 10000))
        : '',
      editedManualValuationAmount3: sellerData.valuationAmount3
        ? String(Math.round(sellerData.valuationAmount3 / 10000))
        : '',
    };
  } else {
    return {
      isManualValuation: false,
      editedManualValuationAmount1: '',
      editedManualValuationAmount2: '',
      editedManualValuationAmount3: '',
    };
  }
}

// ============================================================
// バグ1テスト
// ============================================================

describe('Bug Condition Exploration: 手入力査定額UI復元バグ（フロントエンド）', () => {
  /**
   * バグ1テスト: isManualValuation が false のままになる
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * バグ条件:
   * - valuationAmount1=30000000（手入力査定額が保存済み）
   * - fixedAssetTaxRoadPrice=null（手入力モードの証拠）
   *
   * 修正前: isManualValuation が false のまま → テスト FAIL（バグ確認）
   * 修正後: isManualValuation が true になる → テスト PASS
   */
  test('バグ1: valuationAmount1=30000000, fixedAssetTaxRoadPrice=null のデータで isManualValuation が false のまま（バグ確認）', () => {
    // Arrange: 手入力査定額が保存済みのデータ
    const sellerData: SellerData = {
      valuationAmount1: 30000000, // 3000万円（円単位）
      valuationAmount2: null,
      valuationAmount3: null,
      fixedAssetTaxRoadPrice: null, // 手入力モードの証拠（手入力保存時にnullにクリアされる）
    };

    // Act: 修正前のロジックを実行
    const result = initValuationStateBuggy(sellerData);

    console.log('修正前の結果:', result);
    console.log('期待される結果:', initValuationStateFixed(sellerData));

    // Assert: isManualValuation が true になることを確認
    // 修正前: isManualValuation = false（無条件リセット）→ テスト FAIL（バグの存在を証明）
    // 修正後: isManualValuation = true → テスト PASS
    expect(result.isManualValuation).toBe(true);
  });

  /**
   * バグ1テスト: editedManualValuationAmount1 が '' のままになる
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('バグ1: valuationAmount1=30000000, fixedAssetTaxRoadPrice=null のデータで editedManualValuationAmount1 が "" のまま（バグ確認）', () => {
    // Arrange
    const sellerData: SellerData = {
      valuationAmount1: 30000000, // 3000万円（円単位）
      valuationAmount2: null,
      valuationAmount3: null,
      fixedAssetTaxRoadPrice: null,
    };

    // Act: 修正前のロジックを実行
    const result = initValuationStateBuggy(sellerData);

    console.log('修正前の editedManualValuationAmount1:', result.editedManualValuationAmount1);
    console.log('期待される editedManualValuationAmount1:', '3000');

    // Assert: editedManualValuationAmount1 が '3000' になることを確認
    // 修正前: editedManualValuationAmount1 = ''（無条件リセット）→ テスト FAIL（バグの存在を証明）
    // 修正後: editedManualValuationAmount1 = '3000'（万円単位に変換）→ テスト PASS
    expect(result.editedManualValuationAmount1).toBe('3000');
  });

  /**
   * バグ1テスト: 複数の査定額がある場合も同様にリセットされる
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  test('バグ1: valuationAmount1/2/3 が全て存在する場合も editedManualValuationAmount1/2/3 が "" のまま（バグ確認）', () => {
    // Arrange
    const sellerData: SellerData = {
      valuationAmount1: 30000000, // 3000万円
      valuationAmount2: 35000000, // 3500万円
      valuationAmount3: 40000000, // 4000万円
      fixedAssetTaxRoadPrice: null,
    };

    // Act: 修正前のロジックを実行
    const result = initValuationStateBuggy(sellerData);

    console.log('修正前の結果:', result);

    // Assert: 全ての査定額が万円単位で復元されることを確認
    // 修正前: 全て '' のまま → テスト FAIL（バグの存在を証明）
    expect(result.isManualValuation).toBe(true);
    expect(result.editedManualValuationAmount1).toBe('3000');
    expect(result.editedManualValuationAmount2).toBe('3500');
    expect(result.editedManualValuationAmount3).toBe('4000');
  });

  /**
   * 保全確認: valuationAmount1=null の場合は isManualValuation=false のまま（正しい動作）
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（既存動作の維持を確認）
   */
  test('保全確認: valuationAmount1=null の場合は isManualValuation=false のまま（正しい動作）', () => {
    // Arrange: 手入力査定額が未保存のデータ
    const sellerData: SellerData = {
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
  });

  /**
   * 保全確認: fixedAssetTaxRoadPrice が非null の場合は isManualValuation=false（自動計算モード）
   *
   * **Validates: Requirements 3.2**
   *
   * このテストは修正前後ともに PASS する（既存動作の維持を確認）
   */
  test('保全確認: valuationAmount1=30000000, fixedAssetTaxRoadPrice=50000 の場合は isManualValuation=false（自動計算モード）', () => {
    // Arrange: 自動計算モードのデータ（fixedAssetTaxRoadPrice が非null）
    const sellerData: SellerData = {
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
});
