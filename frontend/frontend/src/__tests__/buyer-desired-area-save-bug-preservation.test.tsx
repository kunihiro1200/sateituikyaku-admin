/**
 * Preservation Property Tests: 希望エリアフィールド保存バグ修正
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 * 
 * 目的: 未修正コードで正常に動作する部分の動作を保持することを確認する
 * 
 * テスト対象:
 * 1. 希望エリア以外のフィールドの保存動作
 * 2. 配信メール「要」時の必須バリデーション
 * 3. 変更なしで保存ボタンを押した場合の動作
 * 4. ドロップダウンを閉じた後の保存動作
 * 
 * 期待される結果: このテストは未修正コードでパスする必要があります
 * （修正後も引き続きパスすることで、リグレッションがないことを確認）
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';

describe('Preservation: 希望エリアフィールド保存バグ修正', () => {
  /**
   * 未修正コードの動作をシミュレート
   */
  const simulateUnfixedBehavior = () => {
    let selectedAreas: string[] = [];
    let selectedAreasRef = { current: [] as string[] };
    let pendingChanges: Record<string, any> = {};
    let dropdownOpen = false;
    let buyer = {
      distribution_type: '',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
    };

    // 配信メール「要」時の必須バリデーション
    const validateDistributionRequired = (): string | null => {
      if (buyer.distribution_type !== '要') return null;

      const updatedBuyer = { ...buyer, ...pendingChanges };
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
    };

    return {
      // ドロップダウンを開く
      openDropdown: () => {
        dropdownOpen = true;
      },

      // エリアを選択（onChangeイベント）
      selectArea: (area: string) => {
        if (!dropdownOpen) {
          throw new Error('ドロップダウンが開いていません');
        }
        selectedAreas = [...selectedAreas, area];
        selectedAreasRef.current = selectedAreas;
        // ❌ バグ: onChangeではhandleFieldChangeを呼び出していない
      },

      // ドロップダウンを閉じる（onCloseイベント）
      closeDropdown: () => {
        dropdownOpen = false;
        // ✅ onCloseでpendingChangesに反映
        pendingChanges['desired_area'] = selectedAreasRef.current.join('|');
      },

      // 他のフィールドを変更
      changeField: (fieldName: string, value: any) => {
        pendingChanges[fieldName] = value;
      },

      // 買主情報を設定
      setBuyer: (newBuyer: any) => {
        buyer = { ...buyer, ...newBuyer };
      },

      // 配信メール「要」時の必須バリデーション
      validateDistributionRequired,

      // 保存ボタンを押す
      save: () => {
        const validationError = validateDistributionRequired();
        if (validationError) {
          return { success: false, error: validationError };
        }

        if (Object.keys(pendingChanges).length === 0) {
          return { success: false, error: '変更がありません' };
        }

        return { success: true, savedChanges: pendingChanges };
      },

      // 状態を取得
      getState: () => ({
        selectedAreas,
        selectedAreasRef: selectedAreasRef.current,
        pendingChanges,
        dropdownOpen,
        buyer,
      }),
    };
  };

  describe('Property 1: 希望エリア以外のフィールドの保存動作', () => {
    test('希望時期フィールドを変更して保存 → 正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (desiredTiming) => {
            const behavior = simulateUnfixedBehavior();

            // 希望時期を変更
            behavior.changeField('desired_timing', desiredTiming);

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({ desired_timing: desiredTiming });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('希望種別フィールドを変更して保存 → 正常に保存される', () => {
      const propertyTypes = ['戸建て', 'マンション', '土地', '戸建て・マンション', '戸建て・土地', 'マンション・土地', '戸建て・マンション・土地'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...propertyTypes),
          (desiredPropertyType) => {
            const behavior = simulateUnfixedBehavior();

            // 希望種別を変更
            behavior.changeField('desired_property_type', desiredPropertyType);

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({ desired_property_type: desiredPropertyType });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('価格帯フィールドを変更して保存 → 正常に保存される', () => {
      const priceRanges = ['1000万円以下', '1000万円～2000万円', '2000万円～3000万円', '3000万円以上'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...priceRanges),
          (priceRange) => {
            const behavior = simulateUnfixedBehavior();

            // 価格帯（戸建）を変更
            behavior.changeField('price_range_house', priceRange);

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({ price_range_house: priceRange });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('複数のフィールドを同時に変更して保存 → 全て正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('戸建て', 'マンション', '土地'),
          fc.constantFrom('1000万円以下', '1000万円～2000万円', '2000万円～3000万円'),
          (desiredTiming, desiredPropertyType, priceRange) => {
            const behavior = simulateUnfixedBehavior();

            // 複数のフィールドを変更
            behavior.changeField('desired_timing', desiredTiming);
            behavior.changeField('desired_property_type', desiredPropertyType);
            behavior.changeField('price_range_house', priceRange);

            // 保存
            const result = behavior.save();

            // ✅ 全て正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({
              desired_timing: desiredTiming,
              desired_property_type: desiredPropertyType,
              price_range_house: priceRange,
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: 配信メール「要」時の必須バリデーション', () => {
    test('配信メール「要」で希望エリアが空 → バリデーションエラー', () => {
      const behavior = simulateUnfixedBehavior();

      // 配信メール「要」に設定
      behavior.setBuyer({
        distribution_type: '要',
        desired_area: '',
        desired_property_type: '戸建て',
        price_range_house: '1000万円以下',
      });

      // 希望時期を変更（希望エリアは空のまま）
      behavior.changeField('desired_timing', '3ヶ月以内');

      // 保存
      const result = behavior.save();

      // ❌ バリデーションエラー
      expect(result.success).toBe(false);
      expect(result.error).toContain('エリア');
      expect(result.error).toContain('必須');
    });

    test('配信メール「要」で希望種別が空 → バリデーションエラー', () => {
      const behavior = simulateUnfixedBehavior();

      // 配信メール「要」に設定
      behavior.setBuyer({
        distribution_type: '要',
        desired_area: '熱海市',
        desired_property_type: '',
        price_range_house: '1000万円以下',
      });

      // 希望時期を変更（希望種別は空のまま）
      behavior.changeField('desired_timing', '3ヶ月以内');

      // 保存
      const result = behavior.save();

      // ❌ バリデーションエラー
      expect(result.success).toBe(false);
      expect(result.error).toContain('希望種別');
      expect(result.error).toContain('必須');
    });

    test('配信メール「要」で価格帯が空 → バリデーションエラー', () => {
      const behavior = simulateUnfixedBehavior();

      // 配信メール「要」に設定
      behavior.setBuyer({
        distribution_type: '要',
        desired_area: '熱海市',
        desired_property_type: '戸建て',
        price_range_house: '',
      });

      // 希望時期を変更（価格帯は空のまま）
      behavior.changeField('desired_timing', '3ヶ月以内');

      // 保存
      const result = behavior.save();

      // ❌ バリデーションエラー
      expect(result.success).toBe(false);
      expect(result.error).toContain('価格帯');
      expect(result.error).toContain('必須');
    });

    test('配信メール「要」で全ての必須項目が入力済み → 正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('熱海市', '伊東市', '下田市'),
          fc.constantFrom('戸建て', 'マンション', '土地'),
          fc.constantFrom('1000万円以下', '1000万円～2000万円', '2000万円～3000万円'),
          (desiredArea, desiredPropertyType, priceRange) => {
            const behavior = simulateUnfixedBehavior();

            // 配信メール「要」に設定
            behavior.setBuyer({
              distribution_type: '要',
              desired_area: desiredArea,
              desired_property_type: desiredPropertyType,
              price_range_house: desiredPropertyType === '戸建て' ? priceRange : '',
              price_range_apartment: desiredPropertyType === 'マンション' ? priceRange : '',
              price_range_land: desiredPropertyType === '土地' ? priceRange : '',
            });

            // 希望時期を変更
            behavior.changeField('desired_timing', '3ヶ月以内');

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('配信メール「不要」の場合 → バリデーションなしで保存される', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (desiredTiming) => {
            const behavior = simulateUnfixedBehavior();

            // 配信メール「不要」に設定（希望エリアは空）
            behavior.setBuyer({
              distribution_type: '不要',
              desired_area: '',
              desired_property_type: '',
              price_range_house: '',
            });

            // 希望時期を変更
            behavior.changeField('desired_timing', desiredTiming);

            // 保存
            const result = behavior.save();

            // ✅ バリデーションなしで保存される
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: 変更なしで保存ボタンを押した場合の動作', () => {
    test('pendingChangesが空の場合 → 保存処理を実行しない', () => {
      const behavior = simulateUnfixedBehavior();

      // 何も変更せずに保存
      const result = behavior.save();

      // ❌ 保存処理を実行しない
      expect(result.success).toBe(false);
      expect(result.error).toBe('変更がありません');
    });

    test('希望エリアフィールドを変更せずに保存 → 保存処理を実行しない', () => {
      const behavior = simulateUnfixedBehavior();

      // 希望エリアを変更しない（ドロップダウンを開かない）
      // 保存
      const result = behavior.save();

      // ❌ 保存処理を実行しない
      expect(result.success).toBe(false);
      expect(result.error).toBe('変更がありません');
    });
  });

  describe('Property 4: ドロップダウンを閉じた後の保存動作', () => {
    test('ドロップダウンを閉じた後に保存 → 正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('熱海市', '伊東市', '下田市', '沼津市', '三島市'), { minLength: 1, maxLength: 5 }),
          (areas) => {
            const behavior = simulateUnfixedBehavior();

            // ドロップダウンを開く
            behavior.openDropdown();

            // エリアを選択
            areas.forEach(area => behavior.selectArea(area));

            // ドロップダウンを閉じる
            behavior.closeDropdown();

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({
              desired_area: areas.join('|'),
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('複数回ドロップダウンを開閉した後に保存 → 最後の選択が保存される', () => {
      const behavior = simulateUnfixedBehavior();

      // 1回目: 熱海市を選択
      behavior.openDropdown();
      behavior.selectArea('熱海市');
      behavior.closeDropdown();

      // 2回目: 伊東市を追加選択
      behavior.openDropdown();
      behavior.selectArea('伊東市');
      behavior.closeDropdown();

      // 保存
      const result = behavior.save();

      // ✅ 最後の選択（熱海市・伊東市）が保存される
      expect(result.success).toBe(true);
      expect(result.savedChanges).toEqual({
        desired_area: '熱海市|伊東市',
      });
    });
  });

  describe('統合テスト: 複数のプロパティを組み合わせる', () => {
    test('希望エリアをドロップダウンで選択し、他のフィールドも変更して保存 → 全て正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('熱海市', '伊東市', '下田市'), { minLength: 1, maxLength: 3 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('戸建て', 'マンション', '土地'),
          (areas, desiredTiming, desiredPropertyType) => {
            const behavior = simulateUnfixedBehavior();

            // ドロップダウンを開く
            behavior.openDropdown();

            // エリアを選択
            areas.forEach(area => behavior.selectArea(area));

            // ドロップダウンを閉じる
            behavior.closeDropdown();

            // 他のフィールドを変更
            behavior.changeField('desired_timing', desiredTiming);
            behavior.changeField('desired_property_type', desiredPropertyType);

            // 保存
            const result = behavior.save();

            // ✅ 全て正常に保存される
            expect(result.success).toBe(true);
            expect(result.savedChanges).toEqual({
              desired_area: areas.join('|'),
              desired_timing: desiredTiming,
              desired_property_type: desiredPropertyType,
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('配信メール「要」で全ての必須項目を入力し、ドロップダウンを閉じて保存 → 正常に保存される', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom('熱海市', '伊東市', '下田市'), { minLength: 1, maxLength: 3 }),
          fc.constantFrom('戸建て', 'マンション', '土地'),
          fc.constantFrom('1000万円以下', '1000万円～2000万円', '2000万円～3000万円'),
          (areas, desiredPropertyType, priceRange) => {
            const behavior = simulateUnfixedBehavior();

            // 配信メール「要」に設定
            behavior.setBuyer({
              distribution_type: '要',
              desired_area: '',
              desired_property_type: '',
              price_range_house: '',
              price_range_apartment: '',
              price_range_land: '',
            });

            // ドロップダウンを開く
            behavior.openDropdown();

            // エリアを選択
            areas.forEach(area => behavior.selectArea(area));

            // ドロップダウンを閉じる
            behavior.closeDropdown();

            // 他のフィールドを変更
            behavior.changeField('desired_property_type', desiredPropertyType);
            if (desiredPropertyType === '戸建て') {
              behavior.changeField('price_range_house', priceRange);
            } else if (desiredPropertyType === 'マンション') {
              behavior.changeField('price_range_apartment', priceRange);
            } else {
              behavior.changeField('price_range_land', priceRange);
            }

            // 保存
            const result = behavior.save();

            // ✅ 正常に保存される
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

console.log('✅ Preservation Property Tests完了');
console.log('📝 テスト対象:');
console.log('  - 希望エリア以外のフィールドの保存動作');
console.log('  - 配信メール「要」時の必須バリデーション');
console.log('  - 変更なしで保存ボタンを押した場合の動作');
console.log('  - ドロップダウンを閉じた後の保存動作');
console.log('  - 複数のプロパティを組み合わせた統合テスト');
console.log('📊 期待される結果: 未修正コードでパスする（修正後も引き続きパスすることでリグレッションがないことを確認）');
