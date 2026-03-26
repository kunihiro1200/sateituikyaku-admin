#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDesiredConditionsPage.tsx の価格帯バリデーションを
希望種別に応じた必須フィールドに変更する。

ルール:
- 希望種別に「戸建て」が含まれる → price_range_house が必須
- 希望種別に「マンション」が含まれる → price_range_apartment が必須
- 希望種別に「土地」が含まれる → price_range_land が必須
- 希望種別が未設定 or 「条件次第」 → 3つのうちいずれか1つが入っていればOK
"""

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. checkDistributionRequiredFields の価格帯チェック部分を修正
old_check = """    // エリア・予算・種別の未入力チェック
    const desiredArea = String(updatedBuyer.desired_area || '').trim();
    const budget = String(updatedBuyer.budget || '').trim();
    const desiredPropertyType = String(updatedBuyer.desired_property_type || '').trim();

    const missing: string[] = [];
    if (!desiredArea) missing.push('エリア');
    if (!budget) missing.push('予算');
    if (!desiredPropertyType) missing.push('希望種別');"""

new_check = """    // エリア・価格帯・種別の未入力チェック
    const desiredArea = String(updatedBuyer.desired_area || '').trim();
    const desiredPropertyType = String(updatedBuyer.desired_property_type || '').trim();
    const priceRangeHouse = String(updatedBuyer.price_range_house || '').trim();
    const priceRangeApartment = String(updatedBuyer.price_range_apartment || '').trim();
    const priceRangeLand = String(updatedBuyer.price_range_land || '').trim();

    const missing: string[] = [];
    if (!desiredArea) missing.push('エリア');
    if (!desiredPropertyType) missing.push('希望種別');

    // 希望種別に応じた価格帯の必須チェック
    const needsHouse = desiredPropertyType.includes('戸建て');
    const needsApartment = desiredPropertyType.includes('マンション');
    const needsLand = desiredPropertyType.includes('土地');
    const hasAnyPriceRange = priceRangeHouse || priceRangeApartment || priceRangeLand;

    if (needsHouse && !priceRangeHouse) missing.push('価格帯（戸建）');
    if (needsApartment && !priceRangeApartment) missing.push('価格帯（マンション）');
    if (needsLand && !priceRangeLand) missing.push('価格帯（土地）');
    // 種別未設定 or 条件次第の場合は3つのうちいずれか1つが必要
    if (!needsHouse && !needsApartment && !needsLand && !hasAnyPriceRange) {
      missing.push('価格帯（戸建・マンション・土地のいずれか）');
    }"""

text = text.replace(old_check, new_check, 1)

# 2. 警告バナーの価格帯チェックも修正
old_banner = """          const missingItems: string[] = [];
          if (!buyer.desired_area) missingItems.push('エリア');
          if (!buyer.budget) missingItems.push('予算');
          if (!buyer.desired_property_type) missingItems.push('希望種別');"""

new_banner = """          const missingItems: string[] = [];
          if (!buyer.desired_area) missingItems.push('エリア');
          if (!buyer.desired_property_type) missingItems.push('希望種別');
          // 希望種別に応じた価格帯チェック
          const _pt = String(buyer.desired_property_type || '').trim();
          const _needsH = _pt.includes('戸建て');
          const _needsA = _pt.includes('マンション');
          const _needsL = _pt.includes('土地');
          const _anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
          if (_needsH && !buyer.price_range_house) missingItems.push('価格帯（戸建）');
          if (_needsA && !buyer.price_range_apartment) missingItems.push('価格帯（マンション）');
          if (_needsL && !buyer.price_range_land) missingItems.push('価格帯（土地）');
          if (!_needsH && !_needsA && !_needsL && !_anyPrice) missingItems.push('価格帯（いずれか）');"""

text = text.replace(old_banner, new_banner, 1)

# 3. フィールドラベルの必須ハイライト条件を修正
# budget → price_range_house/apartment/land に変更
old_highlight = """                  color={
                    buyer.distribution_type === '要' &&
                    ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                    !buyer[field.key]
                      ? 'error'
                      : 'text.secondary'
                  }
                  sx={{ display: 'block', mb: 0.5, fontWeight:
                    buyer.distribution_type === '要' &&
                    ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                    !buyer[field.key]
                      ? 'bold'
                      : 'normal'
                  }}
                >
                  {field.label}
                  {buyer.distribution_type === '要' &&
                   ['desired_area', 'budget', 'desired_property_type'].includes(field.key) &&
                   !buyer[field.key] && ' ※必須'}"""

new_highlight = """                  color={
                    (() => {
                      if (buyer.distribution_type !== '要') return 'text.secondary';
                      const pt = String(buyer.desired_property_type || '').trim();
                      const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                      const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                      const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                      const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                      return (alwaysRequired || houseRequired || aptRequired || landRequired) ? 'error' : 'text.secondary';
                    })()
                  }
                  sx={{ display: 'block', mb: 0.5, fontWeight:
                    (() => {
                      if (buyer.distribution_type !== '要') return 'normal';
                      const pt = String(buyer.desired_property_type || '').trim();
                      const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                      const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                      const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                      const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                      return (alwaysRequired || houseRequired || aptRequired || landRequired) ? 'bold' : 'normal';
                    })()
                  }}
                >
                  {field.label}
                  {(() => {
                    if (buyer.distribution_type !== '要') return null;
                    const pt = String(buyer.desired_property_type || '').trim();
                    const alwaysRequired = ['desired_area', 'desired_property_type'].includes(field.key) && !buyer[field.key];
                    const houseRequired = field.key === 'price_range_house' && pt.includes('戸建て') && !buyer[field.key];
                    const aptRequired = field.key === 'price_range_apartment' && pt.includes('マンション') && !buyer[field.key];
                    const landRequired = field.key === 'price_range_land' && pt.includes('土地') && !buyer[field.key];
                    return (alwaysRequired || houseRequired || aptRequired || landRequired) ? ' ※必須' : null;
                  })()}"""

text = text.replace(old_highlight, new_highlight, 1)

# 4. BuyerDetailPage の distribution_type バリデーションも同様に修正
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    buyer_content = f.read()

buyer_text = buyer_content.decode('utf-8')

old_buyer_check = """                                        if (newValue === '要' && buyer) {
                                        const missingConditions: string[] = [];
                                        if (!buyer.desired_area || !String(buyer.desired_area).trim()) missingConditions.push('エリア');
                                        if (!buyer.budget || !String(buyer.budget).trim()) missingConditions.push('予算');
                                        if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) missingConditions.push('希望種別');
                                        if (missingConditions.length > 0) {"""

new_buyer_check = """                                        if (newValue === '要' && buyer) {
                                        const missingConditions: string[] = [];
                                        if (!buyer.desired_area || !String(buyer.desired_area).trim()) missingConditions.push('エリア');
                                        if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) missingConditions.push('希望種別');
                                        const pt = String(buyer.desired_property_type || '').trim();
                                        const needsH = pt.includes('戸建て');
                                        const needsA = pt.includes('マンション');
                                        const needsL = pt.includes('土地');
                                        const anyPrice = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land;
                                        if (needsH && !buyer.price_range_house) missingConditions.push('価格帯（戸建）');
                                        if (needsA && !buyer.price_range_apartment) missingConditions.push('価格帯（マンション）');
                                        if (needsL && !buyer.price_range_land) missingConditions.push('価格帯（土地）');
                                        if (!needsH && !needsA && !needsL && !anyPrice) missingConditions.push('価格帯（いずれか）');
                                        if (missingConditions.length > 0) {"""

buyer_text = buyer_text.replace(old_buyer_check, new_buyer_check, 1)

# 5. checkMissingFields の budget → price_range チェックも修正
old_missing = """    // 配信メールが「要」の場合は希望条件の3項目も必須
    if (buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
      if (!buyer.desired_area || !String(buyer.desired_area).trim()) {
        missingKeys.push('desired_area');
      }
      if (!buyer.budget || !String(buyer.budget).trim()) {
        missingKeys.push('budget');
      }
      if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) {
        missingKeys.push('desired_property_type');
      }
    }"""

new_missing = """    // 配信メールが「要」の場合は希望条件の必須チェック
    if (buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
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
    }"""

buyer_text = buyer_text.replace(old_missing, new_missing, 1)

# 6. REQUIRED_FIELD_LABEL_MAP に価格帯を追加
old_label_map = """  // 必須フィールドの表示名マップ
  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    budget: '予算（希望条件）',
    desired_property_type: '希望種別（希望条件）',
  };"""

new_label_map = """  // 必須フィールドの表示名マップ
  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    desired_property_type: '希望種別（希望条件）',
    price_range_house: '価格帯（戸建）',
    price_range_apartment: '価格帯（マンション）',
    price_range_land: '価格帯（土地）',
    price_range_any: '価格帯（いずれか）',
  };"""

buyer_text = buyer_text.replace(old_label_map, new_label_map, 1)

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(buyer_text.encode('utf-8'))

print('Done! Price range validation updated.')
