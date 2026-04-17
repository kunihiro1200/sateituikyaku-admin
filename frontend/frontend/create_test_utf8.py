#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.otherProperty.bugCondition.test.ts を UTF-8 で作成するスクリプト
"""

import os

test_content = '''/**
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
import { describe, test, expect } from \'vitest\';
import fc from \'fast-check\';

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
  const hasOtherProperty = !!(buyer.other_company_property && buyer.other_company_property.trim() !== \'\');
  return hasOtherProperty;
};

/**
 * 現在の実装: property_number が null の場合に表示されるUI
 * - 簡易UI（other_company_property_info の1枠のみ）
 * - sync=false でAPIを呼び出す
 */
function renderOtherPropertySection_current(buyer: Buyer | null): {
  showsSimpleUI: boolean;           // property_number が null 時の簡易UI
  showsOtherCompanyProperty: boolean; // 「他社物件」テキストエリア
  showsBuildingNamePrice: boolean;    // 「建物名/価格」テキストエリア
  showsHelperText: boolean;           // 説明文
  saveUsesSync: boolean;              // 保存時に sync=true を使用するか
} {
  const propertyNumber = buyer?.property_number;
  const showsSimpleUI = !propertyNumber; // !buyer?.property_number の場合に簡易UIを表示

  // 簡易UIが表示される場合（バグ条件）
  if (showsSimpleUI) {
    return {
      showsSimpleUI: true,
      showsOtherCompanyProperty: false, // 簡易UIには other_company_property がない
      showsBuildingNamePrice: false,     // 簡易UIには building_name_price がない
      showsHelperText: false,            // 簡易UIには説明文がない
      saveUsesSync: false,               // handleSaveOtherCompanyPropertyInfo は sync=false
    };
  }

  // hasOtherCompanyPropertyData が true の場合（正しいUI）
  const showsFullUI = hasOtherCompanyPropertyData(buyer);
  if (showsFullUI) {
    return {
      showsSimpleUI: false,
      showsOtherCompanyProperty: true,
      showsBuildingNamePrice: true,
      showsHelperText: true,
      saveUsesSync: true, // handleInlineFieldSave は sync=true
    };
  }

  // どちらも表示されない場合
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
  return !buyer.property_number || buyer.property_number === \'\';
}

// -----------------------------------------------------------------------
// タスク1: バグ条件の探索テスト
// このテストは修正前のコードで失敗する（バグの存在を証明する）
// -----------------------------------------------------------------------

describe(\'バグ条件テスト: property_number未設定時の他社物件情報セクション表示\', () => {

  // -----------------------------------------------------------------------
  // 具体的なバグケース（決定論的テスト）
  // -----------------------------------------------------------------------

  test(\'[バグ1] property_number が null の場合、「他社物件」テキストエリアが表示されること\', () => {
    const buyer: Buyer = {
      id: \'test-buyer-1\',
      buyer_number: \'AA1234\',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 「他社物件」テキストエリアが表示される
    // 修正前のコード: 簡易UIのみ表示され、other_company_property は表示されない → 失敗
    expect(result.showsOtherCompanyProperty).toBe(true);
  });

  test(\'[バグ2] property_number が null の場合、「建物名/価格」テキストエリアが表示されること\', () => {
    const buyer: Buyer = {
      id: \'test-buyer-1\',
      buyer_number: \'AA1234\',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 「建物名/価格」テキストエリアが表示される
    // 修正前のコード: 簡易UIのみ表示され、building_name_price は表示されない → 失敗
    expect(result.showsBuildingNamePrice).toBe(true);
  });

  test(\'[バグ3] property_number が null の場合、説明文が表示されること\', () => {
    const buyer: Buyer = {
      id: \'test-buyer-1\',
      buyer_number: \'AA1234\',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 説明文「こちらは詳細な住所のみにしてください...」が表示される
    // 修正前のコード: 簡易UIのみ表示され、説明文は表示されない → 失敗
    expect(result.showsHelperText).toBe(true);
  });

  test(\'[バグ4] property_number が null の場合、保存時に sync=true でAPIが呼ばれること\', () => {
    const buyer: Buyer = {
      id: \'test-buyer-1\',
      buyer_number: \'AA1234\',
      property_number: null,
      other_company_property: null,
      building_name_price: null,
    };

    const result = renderOtherPropertySection_current(buyer);

    // 期待される動作: 保存時に sync=true でAPIが呼ばれる
    // 修正前のコード: handleSaveOtherCompanyPropertyInfo が sync=false でAPIを呼ぶ → 失敗
    expect(result.saveUsesSync).toBe(true);
  });

  test(\'[バグ5] property_number が空文字の場合、「他社物件」テキストエリアが表示されること\', () => {
    const buyer: Buyer = {
      id: \'test-buyer-2\',
      buyer_number: \'AA5678\',
      property_number: \'\',
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

  test(\'[PBT] property_number が null/空の全ての買主データで、期待される動作が実現されること\', () => {
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
            fc.constant(\'\'),
            fc.constant(undefined)
          ),
          other_company_property: fc.oneof(
            fc.constant(null),
            fc.constant(\'\'),
            fc.string({ minLength: 0, maxLength: 100 })
          ),
          building_name_price: fc.oneof(
            fc.constant(null),
            fc.constant(\'\'),
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
'''

output_path = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'src', 'pages', '__tests__',
    'BuyerDetailPage.otherProperty.bugCondition.test.ts'
)

with open(output_path, 'wb') as f:
    f.write(test_content.encode('utf-8'))

print(f'Created: {output_path}')

# BOM チェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b\'\\xef\\xbb\\xbf\')')
print('Done!')
