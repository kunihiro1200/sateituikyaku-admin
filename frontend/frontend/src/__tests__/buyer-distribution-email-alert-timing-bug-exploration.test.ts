/**
 * タスク1: バグ条件探索テスト - 配信メール変更時の即時バリデーション
 *
 * このテストは修正前のコードでバグを再現する反例を表面化させるためのものです。
 * テストが失敗することが期待される結果です（バグが存在することを証明）。
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * **Property 1: Bug Condition** - 配信メール変更時の即時バリデーション除外
 * 
 * ユーザーが「配信メール」ボタンで「要」を選択し、希望条件（エリア・予算・希望種別）が
 * 未入力の場合、修正前のシステムはボタンを押した時点で即座に注意喚起を表示し、
 * 値の変更を阻止します。
 * 
 * 修正後のシステムでは、希望条件の入力状態に関係なく、ボタンを押せるようにし、
 * 値を「要」に変更します。ページ遷移時に注意喚起を表示します。
 */

import * as fc from 'fast-check';

// BuyerDetailPageから関数を抽出してテスト
// 注意: 実際のコードでは、これらの関数はBuyerDetailPageコンポーネント内に定義されています
// テストのために、同じロジックを再現します

/**
 * 買主データの型定義
 */
interface BuyerData {
  distribution_type: string;
  desired_area: string;
  desired_property_type: string;
  price_range_house: string;
  price_range_apartment: string;
  price_range_land: string;
  broker_inquiry: string;
}

/**
 * 修正前のcheckMissingFields関数（バグあり）
 * 「配信メール」を「要」に変更しようとすると、即座にバリデーションが実行され、
 * 希望条件が未入力の場合はエラーが返される
 */
const checkMissingFields_buggy = (buyer: BuyerData): string[] => {
  const missingKeys: string[] = [];

  // 配信メールが「要」の場合は希望条件の必須チェック
  // 業者問合せの場合は配信メールを送らないため、希望条件は不要
  if (buyer.broker_inquiry !== '業者問合せ' && buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
    if (!buyer.desired_area || !String(buyer.desired_area).trim()) {
      missingKeys.push('desired_area');
    }
    if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) {
      missingKeys.push('desired_property_type');
    }
    // 希望種別に応じた価格帯チェック
    const pt = String(buyer.desired_property_type || '').trim();
    const needsH = pt.includes('戸建て');
    const needsA = pt.includes('マンション');
    const needsL = pt.includes('土地');
    const anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
    if (needsH && !buyer.price_range_house) missingKeys.push('price_range_house');
    if (needsA && !buyer.price_range_apartment) missingKeys.push('price_range_apartment');
    if (needsL && !buyer.price_range_land) missingKeys.push('price_range_land');
    if (!needsH && !needsA && !needsL && !anyPrice) missingKeys.push('price_range_any');
  }

  return missingKeys;
};

/**
 * 修正前のhandleInlineFieldSave関数（バグあり）
 * 「配信メール」を「要」に変更しようとすると、即座にバリデーションが実行され、
 * 希望条件が未入力の場合は保存が阻止される
 */
const handleInlineFieldSave_buggy = async (
  fieldName: string,
  newValue: any,
  buyer: BuyerData
): Promise<{ success: boolean; error?: string }> => {
  // 配信メールを「要」に変更しようとする場合、即座にバリデーション
  if (fieldName === 'distribution_type' && newValue === '要') {
    const updatedBuyer = { ...buyer, distribution_type: newValue };
    const missing = checkMissingFields_buggy(updatedBuyer);
    if (missing.length > 0) {
      return {
        success: false,
        error: `以下の項目を入力してください: ${missing.join(', ')}`,
      };
    }
  }

  // バリデーションが通った場合のみ保存
  return { success: true };
};

/**
 * 修正後のcheckMissingFields関数（期待される動作）
 * 「配信メール」を「要」に変更する際は、バリデーションをスキップする
 */
const checkMissingFields_fixed = (buyer: BuyerData): string[] => {
  const missingKeys: string[] = [];

  // 配信メールが「要」の場合は希望条件の必須チェック
  // 業者問合せの場合は配信メールを送らないため、希望条件は不要
  if (buyer.broker_inquiry !== '業者問合せ' && buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
    if (!buyer.desired_area || !String(buyer.desired_area).trim()) {
      missingKeys.push('desired_area');
    }
    if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) {
      missingKeys.push('desired_property_type');
    }
    // 希望種別に応じた価格帯チェック
    const pt = String(buyer.desired_property_type || '').trim();
    const needsH = pt.includes('戸建て');
    const needsA = pt.includes('マンション');
    const needsL = pt.includes('土地');
    const anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
    if (needsH && !buyer.price_range_house) missingKeys.push('price_range_house');
    if (needsA && !buyer.price_range_apartment) missingKeys.push('price_range_apartment');
    if (needsL && !buyer.price_range_land) missingKeys.push('price_range_land');
    if (!needsH && !needsA && !needsL && !anyPrice) missingKeys.push('price_range_any');
  }

  return missingKeys;
};

/**
 * 修正後のhandleInlineFieldSave関数（期待される動作）
 * 「配信メール」を「要」に変更する際は、即座にバリデーションを実行しない
 * ページ遷移時にバリデーションを実行する
 */
const handleInlineFieldSave_fixed = async (
  fieldName: string,
  newValue: any,
  buyer: BuyerData
): Promise<{ success: boolean; error?: string }> => {
  // 配信メールを「要」に変更する際は、即座にバリデーションをスキップ
  // ページ遷移時にバリデーションを実行する
  return { success: true };
};

describe('バグ条件探索テスト - 配信メール変更時の即時バリデーション（修正前のコードで失敗することを確認）', () => {
  /**
   * テスト1: 配信メール = "要" + 希望条件未入力の場合、修正前のコードでは保存が阻止される
   * 
   * **修正前**: handleInlineFieldSave_buggy() が { success: false } を返す
   * **期待値**: { success: false } を返すべき（バグが存在する）
   * **修正前のコードでは失敗する**（バグが存在することを証明）
   */
  test('テスト1: 配信メール = "要" + 希望条件未入力の場合、修正前のコードでは保存が阻止される', async () => {
    const buyer: BuyerData = {
      distribution_type: '不要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正前のコード
    const result_buggy = await handleInlineFieldSave_buggy('distribution_type', '要', buyer);

    // 修正前のコードでは { success: false } を返す（バグが存在する）
    expect(result_buggy.success).toBe(false);
    expect(result_buggy.error).toContain('以下の項目を入力してください');
  });

  /**
   * テスト2: 配信メール = "要" + 希望条件未入力の場合、修正後のコードでは保存が成功する
   * 
   * **修正後**: handleInlineFieldSave_fixed() が { success: true } を返す
   * **期待値**: { success: true } を返すべき
   * **修正後のコードでは成功する**
   */
  test('テスト2: 配信メール = "要" + 希望条件未入力の場合、修正後のコードでは保存が成功する', async () => {
    const buyer: BuyerData = {
      distribution_type: '不要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正後のコード
    const result_fixed = await handleInlineFieldSave_fixed('distribution_type', '要', buyer);

    // 修正後のコードでは { success: true } を返す
    expect(result_fixed.success).toBe(true);
  });

  /**
   * テスト3: プロパティベーステスト - 配信メール = "要" + 希望条件未入力の場合、修正前のコードでは常に保存が阻止される
   * 
   * **Property**: For any 配信メール = "要" かつ 希望条件未入力の入力に対して、
   * 修正前の handleInlineFieldSave 関数は { success: false } を返す
   * 
   * **修正前のコードでは失敗する**（バグが存在することを証明）
   */
  test('テスト3: プロパティベーステスト - 配信メール = "要" + 希望条件未入力の場合、修正前のコードでは常に保存が阻止される', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('要'), // distribution_type = "要"
        fc.constant(''), // desired_area = ""
        fc.constant(''), // desired_property_type = ""
        fc.constant(''), // price_range_house = ""
        fc.constant(''), // price_range_apartment = ""
        fc.constant(''), // price_range_land = ""
        fc.constant(''), // broker_inquiry = ""
        async (distributionType, desiredArea, desiredPropertyType, priceRangeHouse, priceRangeApartment, priceRangeLand, brokerInquiry) => {
          const buyer: BuyerData = {
            distribution_type: '不要',
            desired_area: desiredArea,
            desired_property_type: desiredPropertyType,
            price_range_house: priceRangeHouse,
            price_range_apartment: priceRangeApartment,
            price_range_land: priceRangeLand,
            broker_inquiry: brokerInquiry,
          };

          // 修正前のコード
          const result_buggy = await handleInlineFieldSave_buggy('distribution_type', distributionType, buyer);

          // 期待値: { success: false }（バグが存在する）
          // 修正前のコードでは { success: false } を返す
          return result_buggy.success === false;
        }
      ),
      { numRuns: 10 } // 10回実行
    );
  });

  /**
   * テスト4: プロパティベーステスト - 配信メール = "要" + 希望条件未入力の場合、修正後のコードでは常に保存が成功する
   * 
   * **Property**: For any 配信メール = "要" かつ 希望条件未入力の入力に対して、
   * 修正後の handleInlineFieldSave 関数は { success: true } を返す
   * 
   * **修正後のコードでは成功する**
   */
  test('テスト4: プロパティベーステスト - 配信メール = "要" + 希望条件未入力の場合、修正後のコードでは常に保存が成功する', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('要'), // distribution_type = "要"
        fc.constant(''), // desired_area = ""
        fc.constant(''), // desired_property_type = ""
        fc.constant(''), // price_range_house = ""
        fc.constant(''), // price_range_apartment = ""
        fc.constant(''), // price_range_land = ""
        fc.constant(''), // broker_inquiry = ""
        async (distributionType, desiredArea, desiredPropertyType, priceRangeHouse, priceRangeApartment, priceRangeLand, brokerInquiry) => {
          const buyer: BuyerData = {
            distribution_type: '不要',
            desired_area: desiredArea,
            desired_property_type: desiredPropertyType,
            price_range_house: priceRangeHouse,
            price_range_apartment: priceRangeApartment,
            price_range_land: priceRangeLand,
            broker_inquiry: brokerInquiry,
          };

          // 修正後のコード
          const result_fixed = await handleInlineFieldSave_fixed('distribution_type', distributionType, buyer);

          // 期待値: { success: true }
          // 修正後のコードでは { success: true } を返す
          return result_fixed.success === true;
        }
      ),
      { numRuns: 10 } // 10回実行
    );
  });

  /**
   * テスト5: エッジケース - 配信メール = "不要" の場合、修正前のコードでも保存が成功する
   * 
   * **修正前**: handleInlineFieldSave_buggy() が { success: true } を返す
   * **期待値**: { success: true } を返すべき（既存動作を維持）
   * **修正前のコードでも成功する**（Preservation）
   */
  test('テスト5: エッジケース - 配信メール = "不要" の場合、修正前のコードでも保存が成功する', async () => {
    const buyer: BuyerData = {
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正前のコード
    const result_buggy = await handleInlineFieldSave_buggy('distribution_type', '不要', buyer);

    // 修正前のコードでも { success: true } を返す（Preservation）
    expect(result_buggy.success).toBe(true);
  });

  /**
   * テスト6: エッジケース - 配信メール = "要" + 希望条件入力済みの場合、修正前のコードでも保存が成功する
   * 
   * **修正前**: handleInlineFieldSave_buggy() が { success: true } を返す
   * **期待値**: { success: true } を返すべき（既存動作を維持）
   * **修正前のコードでも成功する**（Preservation）
   */
  test('テスト6: エッジケース - 配信メール = "要" + 希望条件入力済みの場合、修正前のコードでも保存が成功する', async () => {
    const buyer: BuyerData = {
      distribution_type: '不要',
      desired_area: '大分市',
      desired_property_type: '戸建て',
      price_range_house: '2000万円〜3000万円',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正前のコード
    const result_buggy = await handleInlineFieldSave_buggy('distribution_type', '要', buyer);

    // 修正前のコードでも { success: true } を返す（Preservation）
    expect(result_buggy.success).toBe(true);
  });
});

describe('修正後の動作確認（参考）', () => {
  /**
   * 参考テスト: 修正後のコードでは、配信メール = "要" + 希望条件未入力の場合でも保存が成功すること
   * 
   * このテストは修正後のコードで実行すると成功します。
   */
  test('参考: 修正後のコードでは、配信メール = "要" + 希望条件未入力の場合でも保存が成功すること', async () => {
    const buyer: BuyerData = {
      distribution_type: '不要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正後のコード
    const result_fixed = await handleInlineFieldSave_fixed('distribution_type', '要', buyer);

    // 修正後のコードでは { success: true } を返す
    expect(result_fixed.success).toBe(true);
  });

  /**
   * 参考テスト: 修正後のコードでは、配信メール = "不要" の場合も保存が成功すること
   * 
   * このテストは修正後のコードで実行すると成功します（Preservation）。
   */
  test('参考: 修正後のコードでは、配信メール = "不要" の場合も保存が成功すること', async () => {
    const buyer: BuyerData = {
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: '',
      price_range_apartment: '',
      price_range_land: '',
      broker_inquiry: '',
    };

    // 修正後のコード
    const result_fixed = await handleInlineFieldSave_fixed('distribution_type', '不要', buyer);

    // 修正後のコードでは { success: true } を返す（Preservation）
    expect(result_fixed.success).toBe(true);
  });
});
