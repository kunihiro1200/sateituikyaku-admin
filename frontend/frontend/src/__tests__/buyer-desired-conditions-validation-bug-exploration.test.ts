/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - 複数フィールド一括変更時の誤バリデーションエラー
 *
 * このテストは修正前のコードで**必ず失敗する必要があります**
 * 失敗によりバグの存在が確認されます
 *
 * バグ条件: `pendingChanges` に複数フィールドが含まれており、かつ配信メールが「要」の場合に、
 * 個別バリデーションが他の `pendingChanges` を無視して誤エラーを発生させる
 *
 * **Validates: Requirements 1.1, 1.2**
 */

// 未修正コードの動作を再現: 各フィールドを個別にチェック
function validateWithBuggyLogic(buyer: any, pendingChanges: Record<string, any>): string | null {
  for (const [fieldName, newValue] of Object.entries(pendingChanges)) {
    const error = checkDistributionRequiredFields(buyer, fieldName, newValue);
    if (error) return error;
  }
  return null;
}

function checkDistributionRequiredFields(buyer: any, fieldName: string, newValue: any): string | null {
  const updatedBuyer = { ...buyer, [fieldName]: newValue };
  const distributionType = String(updatedBuyer.distribution_type || '').trim();
  if (distributionType !== '要') return null;

  const desiredArea = String(updatedBuyer.desired_area || '').trim();
  const desiredPropertyType = String(updatedBuyer.desired_property_type || '').trim();
  const priceRangeHouse = String(updatedBuyer.price_range_house || '').trim();
  const priceRangeApartment = String(updatedBuyer.price_range_apartment || '').trim();
  const priceRangeLand = String(updatedBuyer.price_range_land || '').trim();

  const missing: string[] = [];
  if (!desiredArea) missing.push('エリア');
  if (!desiredPropertyType) missing.push('希望種別');

  const needsHouse = desiredPropertyType.includes('戸建て');
  const needsApartment = desiredPropertyType.includes('マンション');
  const needsLand = desiredPropertyType.includes('土地');
  const hasAnyPriceRange = priceRangeHouse || priceRangeApartment || priceRangeLand;

  if (needsHouse && !priceRangeHouse) missing.push('価格帯（戸建）');
  if (needsApartment && !priceRangeApartment) missing.push('価格帯（マンション）');
  if (needsLand && !priceRangeLand) missing.push('価格帯（土地）');
  if (!needsHouse && !needsApartment && !needsLand && !hasAnyPriceRange) {
    missing.push('価格帯（戸建・マンション・土地のいずれか）');
  }

  if (missing.length > 0) {
    return `配信メールが「要」の場合、${missing.join('・')}は必須です。希望条件を入力してください。`;
  }
  return null;
}

describe('Bug Condition Exploration: 複数フィールド一括変更時の誤バリデーションエラー', () => {
  /**
   * テストケース1:
   * pendingChanges = { desired_area: '㊶別府', price_range_land: '1000万~2999万' }
   * buyer = { distribution_type: '要', desired_property_type: '土地', desired_area: '', price_range_land: '' }
   *
   * { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
   * 未修正コードでは desired_area チェック時に price_range_land が考慮されず
   * 「価格帯（土地）は必須です」エラーが発生する
   */
  it('テストケース1: desired_area と price_range_land を同時変更 → エラーなしが期待値（未修正コードでFAIL）', () => {
    const buyer = {
      distribution_type: '要',
      desired_property_type: '土地',
      desired_area: '',
      price_range_land: '',
      price_range_house: '',
      price_range_apartment: '',
    };
    const pendingChanges = {
      desired_area: '㊶別府',
      price_range_land: '1000万~2999万',
    };

    // { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
    const result = validateWithBuggyLogic(buyer, pendingChanges);

    // 期待: エラーなし（全フィールドが pendingChanges に含まれているため）
    expect(result).toBeNull();
  });

  /**
   * テストケース2:
   * pendingChanges = { desired_property_type: '戸建て', price_range_house: '1000万~2999万' }
   * buyer = { distribution_type: '要', desired_area: '㊶別府', desired_property_type: '', price_range_house: '' }
   *
   * { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
   * 未修正コードでは desired_property_type チェック時に price_range_house が考慮されず
   * 「価格帯（戸建）は必須です」エラーが発生する
   */
  it('テストケース2: desired_property_type と price_range_house を同時変更 → エラーなしが期待値（未修正コードでFAIL）', () => {
    const buyer = {
      distribution_type: '要',
      desired_area: '㊶別府',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
    };
    const pendingChanges = {
      desired_property_type: '戸建て',
      price_range_house: '1000万~2999万',
    };

    // { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
    const result = validateWithBuggyLogic(buyer, pendingChanges);

    // 期待: エラーなし（全フィールドが pendingChanges に含まれているため）
    expect(result).toBeNull();
  });

  /**
   * テストケース3:
   * pendingChanges = { desired_area: '㊶別府', desired_property_type: '土地', price_range_land: '1000万~2999万' }
   * buyer = { distribution_type: '要', desired_area: '', desired_property_type: '', price_range_land: '' }
   *
   * { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
   * 未修正コードでは最初のフィールドチェック時に他フィールドが無視されてエラーが発生する
   */
  it('テストケース3: 3フィールド同時変更（desired_area, desired_property_type, price_range_land）→ エラーなしが期待値（未修正コードでFAIL）', () => {
    const buyer = {
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_land: '',
      price_range_house: '',
      price_range_apartment: '',
    };
    const pendingChanges = {
      desired_area: '㊶別府',
      desired_property_type: '土地',
      price_range_land: '1000万~2999万',
    };

    // { ...buyer, ...pendingChanges } では全フィールドが揃っているのでエラーなしが期待値
    const result = validateWithBuggyLogic(buyer, pendingChanges);

    // 期待: エラーなし（全フィールドが pendingChanges に含まれているため）
    expect(result).toBeNull();
  });
});
