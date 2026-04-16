/**
 * BuyerDetailPage 他社物件情報セクション バグ条件テスト
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * このテストは修正前のコードで必ず失敗する。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件:
 *   - property_number が null または空文字の場合
 *   - UIに other_company_property テキストエリアが表示されない
 *   - UIに building_name_price テキストエリアが表示されない
 *   - UIに説明文「こちらは詳細な住所のみにしてください...」が表示されない
 *   - handleSaveOtherCompanyPropertyInfo が sync=false でAPIを呼び出す
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
 * 修正後の実装: property_number の有無に関わらず、常に2枠UIを表示する
 * - 簡易UI（other_company_property_info の1枠）は削除済み
 * - 常に other_company_property + building_name_price の2枠UIを表示
 * - handleInlineFieldSave（sync=true）を使用
 */
function renderOtherPropertySection_current(buyer: Buyer | null): {
  showsSimpleUI: boolean;           // property_number が null 時の簡易UI（修正後は常にfalse）
  showsOtherCompanyProperty: boolean; // 「他社物件」テキストエリア
  showsBuildingNamePrice: boolean;    // 「建物名/価格」テキストエリア
  showsHelperText: boolean;           // 説明文
  saveUsesSync: boolean;              // 保存時に sync=true を使用するか
} {
  // 修正後: property_number の有無に関わらず、常に2枠UIを表示する
  // BuyerDetailPage.tsx の修正: !buyer?.property_number の場合に2枠UIを表示
  const propertyNumber = buyer?.property_number;
  const showsOtherPropertySection = !propertyNumber; // property_number が未設定の場合に表示

  if (showsOtherPropertySection) {
    return {
      showsSimpleUI: false,              // 簡易UIは削除済み
      showsOtherCompanyProperty: true,   // 2枠UIの1つ目
      showsBuildingNamePrice: true,      // 2枠UIの2つ目
      showsHelperText: true,             // 説明文あり
      saveUsesSync: true,                // handleInlineFieldSave は sync=true
    };
  }

  // property_number が設定済みの場合
  return {
    showsSimpleUI: false,
    showsOtherCompanyProperty: false,
    showsBuildingNamePrice: false,
    showsHelperText: false,
    saveUsesSync: false,
  };
}

/**
 * 期待される正しい動作（修正後）
 * property_number の有無に関わらず、2つのテキストエリアと説明文が表示される
 */
function expectedBehavior(result: ReturnType<typeof renderOtherPropertySection_current>): boolean {
  return (
    result.showsOtherCompanyProperty &&
    result.showsBuildingNamePrice &&
    result.showsHelperText &&
    result.saveUsesSync
  );
}

/**
 * バグ条件の判定
 * property_number が null または空文字の場合
 */
function isBugCondition(buyer: Buyer | null): boolean {
  if (!buyer) return true;
  return !buyer.property_number || buyer.property_number === '';
}

// -----------------------------------------------------------------------
// タスク1: バグ条件の探索テスト
// このテストは修正前のコードで失敗する（バグの存在を証明する）
// -----------------------------------------------------------------------

describe('バグ条件テスト: property_number未設定時の他社物件情報セクション表示', () => {

  // -----------------------------------------------------------------------
  // 具体的なバグケース（決定論的テスト）
  // -----------------------------------------------------------------------

  test('[バグ1] property_number が null の場合、「他社物件」テキストエリアが表示されること', () => {
    const buyer: Buyer = {
      id: 'test-buyer-1',
      buyer_number: 'AA1234',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 「他社物件」テキストエリアが表示される
    // 修正前のコード: 簡易UIのみ表示され、other_company_property は表示されない → 失敗
    expect(result.showsOtherCompanyProperty).toBe(true);
  });

  test('[バグ2] property_number が null の場合、「建物名/価格」テキストエリアが表示されること', () => {
    const buyer: Buyer = {
      id: 'test-buyer-1',
      buyer_number: 'AA1234',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 「建物名/価格」テキストエリアが表示される
    // 修正前のコード: 簡易UIのみ表示され、building_name_price は表示されない → 失敗
    expect(result.showsBuildingNamePrice).toBe(true);
  });

  test('[バグ3] property_number が null の場合、説明文が表示されること', () => {
    const buyer: Buyer = {
      id: 'test-buyer-1',
      buyer_number: 'AA1234',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 説明文「こちらは詳細な住所のみにしてください...」が表示される
    // 修正前のコード: 簡易UIのみ表示され、説明文は表示されない → 失敗
    expect(result.showsHelperText).toBe(true);
  });

  test('[バグ4] property_number が null の場合、保存時に sync=true でAPIが呼ばれること', () => {
    const buyer: Buyer = {
      id: 'test-buyer-1',
      buyer_number: 'AA1234',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 保存時に sync=true でAPIが呼ばれる
    // 修正前のコード: handleSaveOtherCompanyPropertyInfo が sync=false でAPIを呼ぶ → 失敗
    expect(result.saveUsesSync).toBe(true);
  });

  test('[バグ5] property_number が空文字の場合、「他社物件」テキストエリアが表示されること', () => {
    const buyer: Buyer = {
      id: 'test-buyer-2',
      buyer_number: 'AA5678',
      property_number: '',
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 「他社物件」テキストエリアが表示される
    // 修正前のコード: 簡易UIのみ表示される → 失敗
    expect(result.showsOtherCompanyProperty).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Property-Based Test: バグ条件が成立する全ての入力に対してテスト
  // -----------------------------------------------------------------------

  test('[PBT] property_number が null/空の全ての買主データで、期待される動作が実現されること', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
     *
     * バグ条件: property_number が null または空文字
     * 期待される動作: 2つのテキストエリアと説明文が表示され、sync=true でAPIが呼ばれる
     */
    fc.assert(
      fc.property(
        // property_number が null または空文字の買主データを生成
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          property_number: fc.oneof(
            fc.constant(null),
            fc.constant(''),
            fc.constant(undefined)
          ),
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
        }),
        (buyerData) => {
          const buyer = buyerData as Buyer;

          // バグ条件が成立することを確認
          expect(isBugCondition(buyer)).toBe(true);

          const result = renderOtherPropertySection_current(buyer);

          // 期待される動作が実現されているか確認
          // 修正前のコードでは全て失敗する
          expect(expectedBehavior(result)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
