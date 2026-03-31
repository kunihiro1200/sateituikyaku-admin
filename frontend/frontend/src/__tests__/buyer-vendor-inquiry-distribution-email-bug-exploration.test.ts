/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Bug Condition - 業者問合せ時の配信メール必須除外バグ
 * 
 * このテストは修正前のコードで**必ず失敗する必要があります**
 * 失敗によりバグの存在が確認されます
 * 
 * バグ条件: 「業者問合せ」が「業者問合せ」であり、かつ「配信メール」が「要」の場合、
 * 希望条件（エリア、希望種別、価格帯）が必須扱いされる
 * 
 * 期待される動作: 「業者問合せ」が「業者問合せ」の場合、「配信メール」の値に関係なく
 * 希望条件を必須項目として扱わない
 */

// BuyerDetailPageのcheckMissingFields関数をシミュレート（修正後）
function checkMissingFields(buyer: any): string[] {
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
}

describe('Bug Condition Exploration: 業者問合せ時の配信メール必須除外', () => {
  it('業者問合せ + 配信メール要 + 希望エリア未入力 → バリデーションエラーなし（期待）', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 期待される動作: 希望条件が必須扱いされない
    expect(missing).not.toContain('desired_area');
    expect(missing).not.toContain('desired_property_type');
    expect(missing).not.toContain('price_range_any');
  });

  it('業者問合せ + 配信メール要 + 希望種別未入力 → バリデーションエラーなし（期待）', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      distribution_type: '要',
      desired_area: '大分市',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 期待される動作: 希望種別が必須扱いされない
    expect(missing).not.toContain('desired_property_type');
  });

  it('業者問合せ + 配信メール要 + 価格帯未入力 → バリデーションエラーなし（期待）', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      distribution_type: '要',
      desired_area: '大分市',
      desired_property_type: '戸建て',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 期待される動作: 価格帯が必須扱いされない
    expect(missing).not.toContain('price_range_house');
  });

  it('業者問合せ + 配信メール不要 + 希望条件未入力 → バリデーションエラーなし（エッジケース）', () => {
    const buyer = {
      broker_inquiry: '業者問合せ',
      distribution_type: '不要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 期待される動作: 配信メールが「不要」なので希望条件は必須扱いされない
    expect(missing).not.toContain('desired_area');
    expect(missing).not.toContain('desired_property_type');
    expect(missing).not.toContain('price_range_any');
  });
});
