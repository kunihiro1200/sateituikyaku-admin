/**
 * 保全プロパティテスト - 買主希望条件バリデーションバグ
 *
 * **Feature: buyer-desired-conditions-validation-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（保全すべきベースライン動作を確認）
 *
 * 保全すべき動作:
 * - 配信メールが「要」かつ必須フィールドが未入力の場合はエラーが発生する
 * - 配信メールが「要」以外の場合はバリデーションなしでnullが返る
 * - 1フィールドのみの変更で全必須フィールドが揃っている場合はエラーなし
 */

import * as fc from 'fast-check';

// ============================================================
// 未修正コードの関数（handleSaveAll のバリデーションロジックを再現）
// ============================================================

/**
 * 1フィールド単位で配信メール「要」時の必須チェックを行う関数
 * handleInlineFieldSave で使用される既存関数（変更しない）
 */
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

/**
 * 未修正コードの handleSaveAll バリデーションロジック
 * 各フィールドを個別にチェックする（バグあり）
 */
function validateWithBuggyLogic(buyer: any, pendingChanges: Record<string, any>): string | null {
  for (const [fieldName, newValue] of Object.entries(pendingChanges)) {
    const error = checkDistributionRequiredFields(buyer, fieldName, newValue);
    if (error) return error;
  }
  return null;
}

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 非バグ条件の動作ベースライン確認', () => {

  // ============================================================
  // 観察1: エリア未入力時のエラー（1フィールドのみ変更）
  // ============================================================
  describe('観察1: エリア未入力時のエラー継続', () => {

    /**
     * **Validates: Requirements 3.1, 3.5**
     *
     * pendingChanges = { desired_area: '' }、distribution_type = '要'
     * → 「エリアは必須です」エラーが発生する（保全すべき動作）
     */
    it('テスト1-1: desired_area を空文字に変更 + distribution_type = 要 → エリア必須エラーが発生する', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '土地',
        price_range_land: '3000万円台',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_area: '' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: エリアが未入力の場合はエラーが発生する
      expect(result).not.toBeNull();
      expect(result).toContain('エリア');
    });

    it('テスト1-2: desired_area を空白のみに変更 + distribution_type = 要 → エリア必須エラーが発生する', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '土地',
        price_range_land: '3000万円台',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_area: '   ' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 空白のみのエリアも未入力扱いでエラーが発生する
      expect(result).not.toBeNull();
      expect(result).toContain('エリア');
    });
  });

  // ============================================================
  // 観察2: 価格帯（土地）未入力時のエラー（1フィールドのみ変更）
  // ============================================================
  describe('観察2: 価格帯（土地）未入力時のエラー継続', () => {

    /**
     * **Validates: Requirements 3.1, 3.4**
     *
     * pendingChanges = { desired_property_type: '土地' }、buyer.price_range_land = ''
     * → 「価格帯（土地）は必須です」エラーが発生する（保全すべき動作）
     */
    it('テスト2-1: desired_property_type を土地に変更 + price_range_land が未入力 → 価格帯（土地）必須エラーが発生する', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_property_type: '土地' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 希望種別が「土地」で価格帯（土地）が未入力の場合はエラーが発生する
      expect(result).not.toBeNull();
      expect(result).toContain('価格帯（土地）');
    });

    it('テスト2-2: desired_property_type を戸建てに変更 + price_range_house が未入力 → 価格帯（戸建）必須エラーが発生する', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_property_type: '戸建て' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 希望種別が「戸建て」で価格帯（戸建）が未入力の場合はエラーが発生する
      expect(result).not.toBeNull();
      expect(result).toContain('価格帯（戸建）');
    });

    it('テスト2-3: desired_property_type をマンションに変更 + price_range_apartment が未入力 → 価格帯（マンション）必須エラーが発生する', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_property_type: 'マンション' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 希望種別が「マンション」で価格帯（マンション）が未入力の場合はエラーが発生する
      expect(result).not.toBeNull();
      expect(result).toContain('価格帯（マンション）');
    });
  });

  // ============================================================
  // 観察3: 配信メール「不要」時のバリデーションスキップ
  // ============================================================
  describe('観察3: 配信メール「不要」時のバリデーションスキップ', () => {

    /**
     * **Validates: Requirements 3.2**
     *
     * distribution_type = '不要' → バリデーションなしでnullが返る（保全すべき動作）
     */
    it('テスト3-1: distribution_type = 不要 + 全フィールド未入力 → エラーなし（バリデーションスキップ）', () => {
      const buyer = {
        distribution_type: '不要',
        desired_area: '',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_area: '' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 配信メールが「不要」の場合はバリデーションなし
      expect(result).toBeNull();
    });

    it('テスト3-2: distribution_type = 不要 に変更 → エラーなし（バリデーションスキップ）', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      // distribution_type を「不要」に変更する pendingChanges
      const pendingChanges = { distribution_type: '不要' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 変更後の distribution_type が「不要」なのでバリデーションなし
      expect(result).toBeNull();
    });

    it('テスト3-3: distribution_type が未設定（空文字）→ エラーなし（バリデーションスキップ）', () => {
      const buyer = {
        distribution_type: '',
        desired_area: '',
        desired_property_type: '',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_area: '' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 配信メールが未設定の場合はバリデーションなし
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // 観察4: 1フィールドのみ変更で全必須フィールドが揃っている場合はエラーなし
  // ============================================================
  describe('観察4: 1フィールドのみ変更で全必須フィールドが揃っている場合はエラーなし', () => {

    /**
     * **Validates: Requirements 3.1, 3.3**
     *
     * pendingChanges = { desired_area: '㊶別府' }（1フィールドのみ）、全必須フィールドが揃っている
     * → エラーなし（保全すべき動作）
     */
    it('テスト4-1: desired_area のみ変更 + 全必須フィールドが揃っている → エラーなし', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '',
        desired_property_type: '土地',
        price_range_land: '3000万円台',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { desired_area: '㊶別府' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 1フィールドのみ変更で全必須フィールドが揃っている場合はエラーなし
      expect(result).toBeNull();
    });

    it('テスト4-2: price_range_land のみ変更 + 全必須フィールドが揃っている → エラーなし', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '土地',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { price_range_land: '3000万円台' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 1フィールドのみ変更で全必須フィールドが揃っている場合はエラーなし
      expect(result).toBeNull();
    });

    it('テスト4-3: price_range_house のみ変更 + 全必須フィールドが揃っている → エラーなし', () => {
      const buyer = {
        distribution_type: '要',
        desired_area: '大分市',
        desired_property_type: '戸建て',
        price_range_land: '',
        price_range_house: '',
        price_range_apartment: '',
      };
      const pendingChanges = { price_range_house: '3000万円台' };

      const result = validateWithBuggyLogic(buyer, pendingChanges);

      // ✅ 保全: 1フィールドのみ変更で全必須フィールドが揃っている場合はエラーなし
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // プロパティベーステスト: 配信メール「要」以外の場合は常にバリデーションスキップ
  // ============================================================
  describe('PBT: 配信メール「要」以外の場合は常にバリデーションスキップ', () => {

    /**
     * **Validates: Requirements 3.2**
     *
     * Property 3: Preservation - 配信メール「要」以外の場合はバリデーションスキップ
     * FOR ALL pendingChanges WHERE distribution_type !== '要'
     * ASSERT validateWithBuggyLogic(buyer, pendingChanges) === null
     */
    it('PBT: distribution_type が「要」以外の任意の値の場合、常にnullが返る', () => {
      // 「要」以外の distribution_type ジェネレーター
      const nonRequiredDistributionTypeArb = fc.string().filter(
        (s) => s.trim() !== '要'
      );

      // 任意の pendingChanges（1フィールドのみ）
      const pendingChangesArb = fc.record({
        desired_area: fc.string(),
      });

      fc.assert(
        fc.property(nonRequiredDistributionTypeArb, pendingChangesArb, (distributionType, pendingChanges) => {
          const buyer = {
            distribution_type: distributionType,
            desired_area: '',
            desired_property_type: '',
            price_range_land: '',
            price_range_house: '',
            price_range_apartment: '',
          };

          const result = validateWithBuggyLogic(buyer, pendingChanges);

          // ✅ 保全: 配信メールが「要」以外の場合は常にバリデーションスキップ
          return result === null;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================
  // プロパティベーステスト: 必須フィールドが欠けている場合は常にエラーが発生する
  // ============================================================
  describe('PBT: 必須フィールドが欠けている場合は常にエラーが発生する', () => {

    /**
     * **Validates: Requirements 3.1, 3.4, 3.5**
     *
     * Property 2: Preservation - 必須フィールド未入力時のエラー継続
     * FOR ALL pendingChanges WHERE { ...buyer, ...pendingChanges } で desired_area が空
     *   AND distribution_type = '要'
     * ASSERT validateWithBuggyLogic(buyer, pendingChanges) !== null
     */
    it('PBT: distribution_type = 要 かつ desired_area が空の場合、常にエラーが発生する（1フィールド変更）', () => {
      // desired_area を空にする pendingChanges
      const pendingChangesArb = fc.record({
        desired_area: fc.constant(''),
      });

      fc.assert(
        fc.property(pendingChangesArb, (pendingChanges) => {
          const buyer = {
            distribution_type: '要',
            desired_area: '大分市',
            desired_property_type: '土地',
            price_range_land: '3000万円台',
            price_range_house: '',
            price_range_apartment: '',
          };

          const result = validateWithBuggyLogic(buyer, pendingChanges);

          // ✅ 保全: エリアが空の場合は常にエラーが発生する
          return result !== null && result.includes('エリア');
        }),
        { numRuns: 10 }
      );
    });

    it('PBT: distribution_type = 要 かつ desired_property_type が土地で price_range_land が空の場合、常にエラーが発生する', () => {
      // desired_property_type を土地に変更する pendingChanges（price_range_land は buyer に未設定）
      const pendingChangesArb = fc.record({
        desired_property_type: fc.constant('土地'),
      });

      fc.assert(
        fc.property(pendingChangesArb, (pendingChanges) => {
          const buyer = {
            distribution_type: '要',
            desired_area: '大分市',
            desired_property_type: '',
            price_range_land: '',
            price_range_house: '',
            price_range_apartment: '',
          };

          const result = validateWithBuggyLogic(buyer, pendingChanges);

          // ✅ 保全: 希望種別が「土地」で価格帯（土地）が未入力の場合は常にエラーが発生する
          return result !== null && result.includes('価格帯（土地）');
        }),
        { numRuns: 10 }
      );
    });
  });
});
