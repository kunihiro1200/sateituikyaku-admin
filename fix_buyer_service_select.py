# BuyerService.tsのgetBuyersByAreasメソッドのselectを修正するスクリプト
# inquiry_property_type -> property_type
# inquiry_price -> price
# property_address -> 削除（動的付与に変更）

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のselect文
old_select = """          buyer_id,
          buyer_number,
          name,
          latest_status,
          latest_viewing_date,
          inquiry_confidence,
          inquiry_source,
          distribution_type,
          distribution_areas,
          broker_inquiry,
          desired_area,
          desired_property_type,
          price_range_house,
          price_range_apartment,
          price_range_land,
          reception_date,
          email,
          phone_number,
          inquiry_property_type,
          property_address,
          inquiry_price,
          inquiry_hearing,
          viewing_result_follow_up"""

# 修正後のselect文
new_select = """          buyer_id,
          buyer_number,
          name,
          latest_status,
          latest_viewing_date,
          inquiry_confidence,
          inquiry_source,
          distribution_type,
          distribution_areas,
          broker_inquiry,
          desired_area,
          desired_property_type,
          price_range_house,
          price_range_apartment,
          price_range_land,
          reception_date,
          email,
          phone_number,
          property_type,
          property_number,
          price,
          inquiry_hearing,
          viewing_result_follow_up"""

if old_select in text:
    text = text.replace(old_select, new_select)
    print('select文を修正しました')
else:
    print('ERROR: 対象のselect文が見つかりませんでした')
    # デバッグ用に周辺を確認
    idx = text.find('inquiry_property_type')
    if idx >= 0:
        print(f'inquiry_property_type が {idx} 行目付近に見つかりました:')
        print(repr(text[max(0, idx-200):idx+200]))
    else:
        print('inquiry_property_type は見つかりませんでした')

# getBuyersByAreasのreturn部分でproperty_addressを動的付与するよう修正
# 現在: return sortedBuyers.map(buyer => ({...buyer, distribution_areas: ...}))
# 修正後: property_addressも付与する

old_return = """    return sortedBuyers.map(buyer => ({
      ...buyer,
      distribution_areas: this.parseDistributionAreas(buyer.distribution_areas || buyer.desired_area)
    }));"""

new_return = """    // property_listingsからproperty_addressを取得して付与
    const propertyNumbers = [...new Set(
      sortedBuyers.map((b: any) => b.property_number).filter(Boolean)
    )] as string[];

    let propertyAddressMap: Record<string, string | null> = {};
    if (propertyNumbers.length > 0) {
      const { data: properties } = await this.supabase
        .from('property_listings')
        .select('property_number, address')
        .in('property_number', propertyNumbers);
      if (properties) {
        properties.forEach((p: any) => {
          propertyAddressMap[p.property_number] = p.address ?? null;
        });
      }
    }

    return sortedBuyers.map(buyer => ({
      ...buyer,
      distribution_areas: this.parseDistributionAreas(buyer.distribution_areas || buyer.desired_area),
      inquiry_property_type: buyer.property_type ?? null,
      inquiry_price: buyer.price ?? null,
      property_address: propertyAddressMap[buyer.property_number] ?? null,
    }));"""

if old_return in text:
    text = text.replace(old_return, new_return)
    print('return文を修正しました（property_address動的付与を追加）')
else:
    print('ERROR: 対象のreturn文が見つかりませんでした')
    idx = text.find('parseDistributionAreas(buyer.distribution_areas')
    if idx >= 0:
        print(f'parseDistributionAreas が {idx} 付近に見つかりました:')
        print(repr(text[max(0, idx-300):idx+300]))

# UTF-8で書き込む（BOMなし）
with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
