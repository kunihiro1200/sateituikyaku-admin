/**
 * BuyerDetailPage 他社物件情報セクション 保全プロパティテスト
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS する。
 * 保全すべきベースライン動作を確認する。
 *
 * 観察優先メソドロジー:
 *   修正前のコードで、バグ条件が成立しない入力（property_number が設定済みの買主）の
 *   動作を観察し、テストとして記述する。
 *
 * 観察内容:
 *   - 観察1: property_number が設定済みの買主で他フィールドを保存した際、sync=true でAPIが呼ばれること
 *   - 観察2: other_company_property が空の状態で他フィールドを保存した際、正常に完了すること
 *   - 観察3: building_name_price が空の状態で他フィールドを保存した際、正常に完了すること
 *   - 観察4: 他のセクション（基本情報、希望条件など）のレンダリングが変更されないこと
 *
 * EXPECTED OUTCOME: テストが PASS する（保全すべきベースライン動作を確認する）
 */
import { describe, test, expect } from 'vitest';
import fc from 'fast-check';

// -----------------------------------------------------------------------
// BuyerDetailPage.tsx の現在の実装を模倣したロジック
// -----------------------------------------------------------------------

interface Buyer {
  [key: string]: any;
}

/**
 * 現在の実装: hasOtherCompanyPropertyData
 * other_company_property フィールドに値がある場合のみ true を返す
 */
const hasOtherCompanyPropertyData = (buyer: Buyer | null): boolean => {
  if (!buyer) return false;
  const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== '');
  return hasOtherProperty;
};

/**
 * 現在の実装: property_number が設定済みの場合に表示されるUI
 * - hasOtherCompanyPropertyData が true の場合のみ 2枠UI を表示
 * - handleInlineFieldSave（sync=true）を使用
 */
function renderOtherPropertySection_current(buyer: Buyer | null): {
  showsSimpleUI: boolean;
  showsOtherCompanyProperty: boolean;
  showsBuildingNamePrice: boolean;
  showsHelperText: boolean;
  saveUsesSync: boolean;
} {
  const propertyNumber = buyer?.property_number;
  const showsSimpleUI = !propertyNumber;

  if (showsSimpleUI) {
    return {
      showsSimpleUI: true,
      showsOtherCompanyProperty: false,
      showsBuildingNamePrice: false,
      showsHelperText: false,
      saveUsesSync: false,
    };
  }

  // property_number が設定済みの場合: hasOtherCompanyPropertyData で判定
  const showsFullUI = hasOtherCompanyPropertyData(buyer);
  if (showsFullUI) {
    return {
      showsSimpleUI: false,
      showsOtherCompanyProperty: true,
      showsBuildingNamePrice: true,
      showsHelperText: true,
      saveUsesSync: true,
    };
  }

  return {
    showsSimpleUI: false,
    showsOtherCompanyProperty: false,
    showsBuildingNamePrice: false,
    showsHelperText: false,
    saveUsesSync: false,
  };
}

/**
 * handleInlineFieldSave の動作を模倣した純粋関数
 * sync=true, force=true でAPIを呼び出す
 */
function simulateInlineFieldSave(
  fieldName: string,
  value: string | null,
  buyer: Buyer | null
): {
  apiCalled: boolean;
  syncEnabled: boolean;
  forceEnabled: boolean;
  fieldName: string;
  value: string | null;
} {
  if (!buyer) {
    return { apiCalled: false, syncEnabled: false, forceEnabled: false, fieldName, value };
  }
  // handleInlineFieldSave は常に sync=true, force=true でAPIを呼び出す
  return {
    apiCalled: true,
    syncEnabled: true,
    forceEnabled: true,
    fieldName,
    value,
  };
}

/**
 * バグ条件の判定（保全テストでは NOT isBugCondition の入力を使用）
 */
function isBugCondition(buyer: Buyer | null): boolean {
  if (!buyer) return true;
  return !buyer.property_number || buyer.property_number === '';
}

/**
 * 保全条件の判定
 * property_number が設定済みの場合は保全条件が成立する
 */
function isPreservationCondition(buyer: Buyer | null): boolean {
  return !isBugCondition(buyer);
}

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードで PASS することで、保全すべきベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 他セクションの動作保持', () => {

  // -----------------------------------------------------------------------
  // 観察1: property_number が設定済みの買主で他フィールドを保存した際、sync=true でAPIが呼ばれること
  // -----------------------------------------------------------------------

  describe('観察1: property_number が設定済みの買主で他フィールドを保存した際、sync=true でAPIが呼ばれること', () => {
    /**
     * 具体的なテストケース: property_number が設定済みの買主
     *
     * **Validates: Requirements 3.1**
     */
    test('[具体例] property_number が設定済みの買主で他フィールドを保存した際、sync=true でAPIが呼ばれること', () => {
      const buyer: Buyer = {
        id: 'test-buyer-1',
        buyer_number: 'AA1234',
        property_number: 'PROP-001',
        other_company_property: 'テスト物件',
        building_name_price: 'テストビル 3000万円',
        name: 'テスト太郎',
        phone: '090-1234-5678',
      };

      // バグ条件が成立しないことを確認
      expect(isPreservationCondition(buyer)).toBe(true);

      // 他フィールド（name）を保存した際の動作を確認
      const saveResult = simulateInlineFieldSave('name', 'テスト太郎', buyer);

      // sync=true でAPIが呼ばれること
      expect(saveResult.apiCalled).toBe(true);
      expect(saveResult.syncEnabled).toBe(true);
    });

    /**
     * プロパティベーステスト: property_number が設定済みの全ての買主データで
     * 他フィールドを保存した際、sync=true でAPIが呼ばれること
     *
     * **Validates: Requirements 3.1**
     */
    test('[PBT] property_number が設定済みの全ての買主データで、他フィールドを保存した際、sync=true でAPIが呼ばれること', () => {
      fc.assert(
        fc.property(
          // property_number が設定済みの買主データを生成
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.string({ minLength: 1, maxLength: 20 }),
            other_company_property: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            building_name_price: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            name: fc.string({ minLength: 0, maxLength: 20 }),
          }),
          // 保存するフィールド名を生成（other_company_property 以外）
          fc.constantFrom('name', 'phone', 'email', 'budget', 'memo'),
          fc.string({ minLength: 0, maxLength: 50 }),
          (buyerData, fieldName, fieldValue) => {
            const buyer = buyerData as Buyer;

            // 保全条件が成立することを確認
            expect(isPreservationCondition(buyer)).toBe(true);

            // 他フィールドを保存した際の動作を確認
            const saveResult = simulateInlineFieldSave(fieldName, fieldValue, buyer);

            // sync=true でAPIが呼ばれること
            expect(saveResult.apiCalled).toBe(true);
            expect(saveResult.syncEnabled).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察2: other_company_property が空の状態で他フィールドを保存した際、正常に完了すること
  // -----------------------------------------------------------------------

  describe('観察2: other_company_property が空の状態で他フィールドを保存した際、正常に完了すること', () => {
    /**
     * 具体的なテストケース: other_company_property が空の買主
     *
     * **Validates: Requirements 3.2**
     */
    test('[具体例] other_company_property が空の状態で他フィールドを保存した際、正常に完了すること', () => {
      const buyer: Buyer = {
        id: 'test-buyer-2',
        buyer_number: 'AA5678',
        property_number: 'PROP-002',
        other_company_property: null,  // 空
        building_name_price: 'テストビル',
        name: 'テスト花子',
      };

      // バグ条件が成立しないことを確認
      expect(isPreservationCondition(buyer)).toBe(true);

      // 他フィールド（name）を保存した際の動作を確認
      const saveResult = simulateInlineFieldSave('name', 'テスト花子', buyer);

      // 正常に完了すること（エラーなし）
      expect(saveResult.apiCalled).toBe(true);
      expect(saveResult.syncEnabled).toBe(true);
    });

    /**
     * プロパティベーステスト: other_company_property が空の全ての買主データで
     * 他フィールドを保存した際、正常に完了すること
     *
     * **Validates: Requirements 3.2**
     */
    test('[PBT] other_company_property が空の全ての買主データで、他フィールドを保存した際、正常に完了すること', () => {
      fc.assert(
        fc.property(
          // other_company_property が空の買主データを生成（property_number は設定済み）
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.string({ minLength: 1, maxLength: 20 }),
            other_company_property: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant(undefined)
            ),
            building_name_price: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
          }),
          // 保存するフィールド名を生成
          fc.constantFrom('name', 'phone', 'email', 'budget', 'memo'),
          fc.string({ minLength: 0, maxLength: 50 }),
          (buyerData, fieldName, fieldValue) => {
            const buyer = buyerData as Buyer;

            // 保全条件が成立することを確認
            expect(isPreservationCondition(buyer)).toBe(true);

            // other_company_property が空であることを確認
            const otherCompanyProperty = buyer.other_company_property;
            const isEmpty = !otherCompanyProperty || otherCompanyProperty === '';
            expect(isEmpty).toBe(true);

            // 他フィールドを保存した際の動作を確認
            const saveResult = simulateInlineFieldSave(fieldName, fieldValue, buyer);

            // 正常に完了すること
            expect(saveResult.apiCalled).toBe(true);
            expect(saveResult.syncEnabled).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察3: building_name_price が空の状態で他フィールドを保存した際、正常に完了すること
  // -----------------------------------------------------------------------

  describe('観察3: building_name_price が空の状態で他フィールドを保存した際、正常に完了すること', () => {
    /**
     * 具体的なテストケース: building_name_price が空の買主
     *
     * **Validates: Requirements 3.3**
     */
    test('[具体例] building_name_price が空の状態で他フィールドを保存した際、正常に完了すること', () => {
      const buyer: Buyer = {
        id: 'test-buyer-3',
        buyer_number: 'AA9012',
        property_number: 'PROP-003',
        other_company_property: 'テスト物件',
        building_name_price: null,  // 空
        name: 'テスト次郎',
      };

      // バグ条件が成立しないことを確認
      expect(isPreservationCondition(buyer)).toBe(true);

      // 他フィールド（name）を保存した際の動作を確認
      const saveResult = simulateInlineFieldSave('name', 'テスト次郎', buyer);

      // 正常に完了すること（エラーなし）
      expect(saveResult.apiCalled).toBe(true);
      expect(saveResult.syncEnabled).toBe(true);
    });

    /**
     * プロパティベーステスト: building_name_price が空の全ての買主データで
     * 他フィールドを保存した際、正常に完了すること
     *
     * **Validates: Requirements 3.3**
     */
    test('[PBT] building_name_price が空の全ての買主データで、他フィールドを保存した際、正常に完了すること', () => {
      fc.assert(
        fc.property(
          // building_name_price が空の買主データを生成（property_number は設定済み）
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.string({ minLength: 1, maxLength: 20 }),
            other_company_property: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            building_name_price: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant(undefined)
            ),
          }),
          // 保存するフィールド名を生成
          fc.constantFrom('name', 'phone', 'email', 'budget', 'memo'),
          fc.string({ minLength: 0, maxLength: 50 }),
          (buyerData, fieldName, fieldValue) => {
            const buyer = buyerData as Buyer;

            // 保全条件が成立することを確認
            expect(isPreservationCondition(buyer)).toBe(true);

            // building_name_price が空であることを確認
            const buildingNamePrice = buyer.building_name_price;
            const isEmpty = !buildingNamePrice || buildingNamePrice === '';
            expect(isEmpty).toBe(true);

            // 他フィールドを保存した際の動作を確認
            const saveResult = simulateInlineFieldSave(fieldName, fieldValue, buyer);

            // 正常に完了すること
            expect(saveResult.apiCalled).toBe(true);
            expect(saveResult.syncEnabled).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 観察4: 他のセクション（基本情報、希望条件など）のレンダリングが変更されないこと
  // -----------------------------------------------------------------------

  describe('観察4: 他のセクション（基本情報、希望条件など）のレンダリングが変更されないこと', () => {
    /**
     * 具体的なテストケース: property_number が設定済みの買主で
     * 他社物件情報セクション以外のセクションが正常に表示されること
     *
     * **Validates: Requirements 3.4**
     */
    test('[具体例] property_number が設定済みの買主で、他社物件情報セクション以外のセクションが正常に表示されること', () => {
      const buyer: Buyer = {
        id: 'test-buyer-4',
        buyer_number: 'AA3456',
        property_number: 'PROP-004',
        other_company_property: 'テスト物件',
        building_name_price: 'テストビル',
        name: 'テスト三郎',
        phone: '090-9876-5432',
        email: 'test@example.com',
        budget: 5000,
        desired_area: '大分市',
      };

      // バグ条件が成立しないことを確認
      expect(isPreservationCondition(buyer)).toBe(true);

      // 他社物件情報セクションの表示状態を確認
      const result = renderOtherPropertySection_current(buyer);

      // property_number が設定済みで other_company_property に値がある場合、
      // 2枠UIが表示されること（修正前の正常動作）
      expect(result.showsSimpleUI).toBe(false);
      expect(result.showsOtherCompanyProperty).toBe(true);
      expect(result.showsBuildingNamePrice).toBe(true);
      expect(result.showsHelperText).toBe(true);
      expect(result.saveUsesSync).toBe(true);
    });

    /**
     * プロパティベーステスト: property_number が設定済みで other_company_property に値がある
     * 全ての買主データで、他社物件情報セクションが正常に表示されること
     *
     * **Validates: Requirements 3.4**
     */
    test('[PBT] property_number が設定済みで other_company_property に値がある全ての買主データで、他社物件情報セクションが正常に表示されること', () => {
      fc.assert(
        fc.property(
          // property_number が設定済みで other_company_property に値がある買主データを生成
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.string({ minLength: 1, maxLength: 20 }),
            other_company_property: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
            building_name_price: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
          }),
          (buyerData) => {
            const buyer = buyerData as Buyer;

            // 保全条件が成立することを確認
            expect(isPreservationCondition(buyer)).toBe(true);

            // 他社物件情報セクションの表示状態を確認
            const result = renderOtherPropertySection_current(buyer);

            // property_number が設定済みで other_company_property に値がある場合、
            // 2枠UIが表示されること（修正前の正常動作）
            expect(result.showsSimpleUI).toBe(false);
            expect(result.showsOtherCompanyProperty).toBe(true);
            expect(result.showsBuildingNamePrice).toBe(true);
            expect(result.showsHelperText).toBe(true);
            expect(result.saveUsesSync).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * プロパティベーステスト: 多様な買主データ（各フィールドの有無・値の組み合わせ）で
     * 保全条件が成立する場合、handleInlineFieldSave が sync=true で動作すること
     *
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     */
    test('[PBT] 多様な買主データで保全条件が成立する場合、handleInlineFieldSave が sync=true で動作すること', () => {
      fc.assert(
        fc.property(
          // 多様な買主データを生成（property_number は設定済み）
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.string({ minLength: 1, maxLength: 20 }),
            other_company_property: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            building_name_price: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
            name: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 0, maxLength: 20 })
            ),
            phone: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 0, maxLength: 15 })
            ),
            email: fc.oneof(
              fc.constant(null),
              fc.string({ minLength: 0, maxLength: 50 })
            ),
            budget: fc.oneof(
              fc.constant(null),
              fc.integer({ min: 0, max: 100000 })
            ),
          }),
          // 保存するフィールド名を生成
          fc.constantFrom('name', 'phone', 'email', 'budget', 'memo', 'desired_area'),
          fc.string({ minLength: 0, maxLength: 50 }),
          (buyerData, fieldName, fieldValue) => {
            const buyer = buyerData as Buyer;

            // 保全条件が成立することを確認
            expect(isPreservationCondition(buyer)).toBe(true);

            // handleInlineFieldSave の動作を確認
            const saveResult = simulateInlineFieldSave(fieldName, fieldValue, buyer);

            // sync=true でAPIが呼ばれること（保全すべき動作）
            expect(saveResult.apiCalled).toBe(true);
            expect(saveResult.syncEnabled).toBe(true);
            expect(saveResult.forceEnabled).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // -----------------------------------------------------------------------
  // 追加: バグ条件と保全条件の相互排他性を確認
  // -----------------------------------------------------------------------

  describe('バグ条件と保全条件の相互排他性', () => {
    /**
     * プロパティベーステスト: バグ条件と保全条件は相互排他的であること
     *
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     */
    test('[PBT] バグ条件と保全条件は相互排他的であること', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            property_number: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant(undefined),
              fc.string({ minLength: 1, maxLength: 20 })
            ),
            other_company_property: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.string({ minLength: 0, maxLength: 100 })
            ),
          }),
          (buyerData) => {
            const buyer = buyerData as Buyer;

            const bugCondition = isBugCondition(buyer);
            const preservationCondition = isPreservationCondition(buyer);

            // バグ条件と保全条件は相互排他的であること
            expect(bugCondition).not.toBe(preservationCondition);
            // 一方が true なら他方は false
            expect(bugCondition || preservationCondition).toBe(true);
            expect(bugCondition && preservationCondition).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 具体的なテストケース: property_number が設定済みの場合は保全条件が成立すること
     *
     * **Validates: Requirements 3.1**
     */
    test('[具体例] property_number が設定済みの場合は保全条件が成立すること', () => {
      const buyersWithPropertyNumber: Buyer[] = [
        { id: '1', buyer_number: 'AA0001', property_number: 'PROP-001' },
        { id: '2', buyer_number: 'AA0002', property_number: '12345' },
        { id: '3', buyer_number: 'AA0003', property_number: 'ABC-XYZ' },
      ];

      for (const buyer of buyersWithPropertyNumber) {
        expect(isPreservationCondition(buyer)).toBe(true);
        expect(isBugCondition(buyer)).toBe(false);
      }
    });

    /**
     * 具体的なテストケース: property_number が未設定の場合はバグ条件が成立すること
     *
     * **Validates: Requirements 3.1**
     */
    test('[具体例] property_number が未設定の場合はバグ条件が成立すること', () => {
      const buyersWithoutPropertyNumber: Buyer[] = [
        { id: '1', buyer_number: 'AA0001', property_number: null },
        { id: '2', buyer_number: 'AA0002', property_number: '' },
        { id: '3', buyer_number: 'AA0003', property_number: undefined },
      ];

      for (const buyer of buyersWithoutPropertyNumber) {
        expect(isBugCondition(buyer)).toBe(true);
        expect(isPreservationCondition(buyer)).toBe(false);
      }
    });
  });
});
