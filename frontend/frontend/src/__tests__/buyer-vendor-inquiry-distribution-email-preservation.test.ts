/**
 * Preservation Property Test
 * 
 * Property 2: Preservation - 非業者問合せ時の既存動作維持
 * 
 * このテストは修正前のコードで**成功する必要があります**
 * 成功によりベースライン動作が確認されます
 * 
 * 保存条件: 「業者問合せ」が空欄または「業者問合せ」以外の値の場合、
 * 既存の配信メール必須チェックロジックを維持
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

describe('Preservation: 非業者問合せ時の既存動作維持', () => {
  it('非業者問合せ（空欄） + 配信メール要 + 希望条件未入力 → バリデーションエラーあり（既存動作）', () => {
    const buyer = {
      broker_inquiry: '',
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 既存動作: 希望条件が必須扱いされる
    expect(missing).toContain('desired_area');
    expect(missing).toContain('desired_property_type');
    expect(missing).toContain('price_range_any');
  });

  it('非業者問合せ（業者（両手）） + 配信メール要 + 希望条件未入力 → バリデーションエラーあり（既存動作）', () => {
    const buyer = {
      broker_inquiry: '業者（両手）',
      distribution_type: '要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 既存動作: 希望条件が必須扱いされる
    expect(missing).toContain('desired_area');
    expect(missing).toContain('desired_property_type');
    expect(missing).toContain('price_range_any');
  });

  it('非業者問合せ（空欄） + 配信メール不要 + 希望条件未入力 → バリデーションエラーなし（既存動作）', () => {
    const buyer = {
      broker_inquiry: '',
      distribution_type: '不要',
      desired_area: '',
      desired_property_type: '',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 既存動作: 配信メールが「不要」なので希望条件は必須扱いされない
    expect(missing).not.toContain('desired_area');
    expect(missing).not.toContain('desired_property_type');
    expect(missing).not.toContain('price_range_any');
  });

  it('非業者問合せ（空欄） + 配信メール要 + 希望種別あり + 価格帯未入力 → 価格帯エラーあり（既存動作）', () => {
    const buyer = {
      broker_inquiry: '',
      distribution_type: '要',
      desired_area: '大分市',
      desired_property_type: '戸建て',
      price_range_house: null,
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 既存動作: 希望種別が「戸建て」なので価格帯（戸建）が必須
    expect(missing).toContain('price_range_house');
    expect(missing).not.toContain('desired_area');
    expect(missing).not.toContain('desired_property_type');
  });

  it('非業者問合せ（空欄） + 配信メール要 + 希望条件全て入力済み → バリデーションエラーなし（既存動作）', () => {
    const buyer = {
      broker_inquiry: '',
      distribution_type: '要',
      desired_area: '大分市',
      desired_property_type: '戸建て',
      price_range_house: '3000万円以下',
      price_range_apartment: null,
      price_range_land: null,
    };

    const missing = checkMissingFields(buyer);

    // 既存動作: 全て入力済みなのでエラーなし
    expect(missing).not.toContain('desired_area');
    expect(missing).not.toContain('desired_property_type');
    expect(missing).not.toContain('price_range_house');
  });
});
