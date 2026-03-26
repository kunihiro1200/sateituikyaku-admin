with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# propertiesテーブルのinsertを正しいカラム名に修正
old = """    const { error: propertyError } = await this.table('properties').insert({
      seller_id: seller.id,
      property_address: data.property.address,
      prefecture: data.property.prefecture,
      city: data.property.city,
      property_type: data.property.propertyType,
      land_area: data.property.landArea,
      building_area: data.property.buildingArea,
      build_year: data.property.buildYear,
      structure: data.property.structure,
      floors: data.property.floors,
      rooms: data.property.rooms,
      parking: data.property.parking,
      additional_info: data.property.additionalInfo,
    });"""

new = """    const { error: propertyError } = await this.table('properties').insert({
      seller_id: seller.id,
      property_address: data.property.address,
      property_type: data.property.propertyType || '戸建て',
      land_area: data.property.landArea || null,
      building_area: data.property.buildingArea || null,
      land_area_verified: data.property.landAreaVerified || null,
      building_area_verified: data.property.buildingAreaVerified || null,
      construction_year: data.property.buildYear || null,
      structure: data.property.structure || null,
      floor_plan: data.property.floorPlan || null,
      current_status: data.property.sellerSituation || null,
      property_address_ieul_apartment: data.property.propertyAddressForIeulMansion || null,
    });"""

# CRLF版
old_crlf = old.replace('\n', '\r\n')
new_crlf = new.replace('\n', '\r\n')

if old_crlf in text:
    text = text.replace(old_crlf, new_crlf, 1)
    print('OK (CRLF)')
elif old in text:
    text = text.replace(old, new, 1)
    print('OK (LF)')
else:
    # 現在の状態確認
    idx = text.find("this.table('properties').insert")
    print('ERROR. Current:')
    print(repr(text[idx:idx+500]))

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
