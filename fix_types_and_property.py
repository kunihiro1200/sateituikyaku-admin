import re

# 1. PropertyInfo型にpropertyAddressForIeulMansionを追加
with open('backend/src/types/index.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = "  additionalInfo?: string;\r\n}"
new = "  additionalInfo?: string;\r\n  propertyAddressForIeulMansion?: string;\r\n}"
if old in text:
    text = text.replace(old, new, 1)
    print('OK types (CRLF)')
else:
    old_lf = "  additionalInfo?: string;\n}"
    new_lf = "  additionalInfo?: string;\n  propertyAddressForIeulMansion?: string;\n}"
    if old_lf in text:
        text = text.replace(old_lf, new_lf, 1)
        print('OK types (LF)')
    else:
        print('ERROR types: not found')

with open('backend/src/types/index.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

# 2. createSellerのproperty_typeをDBの日本語値にマッピング
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# property_type のマッピングを追加
old = "    const { error: propertyError } = await this.table('properties').insert({\r\n      seller_id: seller.id,\r\n      property_address: data.property.address,\r\n      property_type: data.property.propertyType || '戸建て',"
new = """    // property_typeをDBの日本語値にマッピング
    const propertyTypeMap: Record<string, string> = {
      'detached_house': '戸建て',
      'apartment': 'マンション',
      'land': '土地',
      'commercial': '戸建て', // フォールバック
    };
    const mappedPropertyType = propertyTypeMap[data.property.propertyType as string] || data.property.propertyType || '戸建て';

    const { error: propertyError } = await this.table('properties').insert({
      seller_id: seller.id,
      property_address: data.property.address,
      property_type: mappedPropertyType,"""

if old in text:
    text = text.replace(old, new, 1)
    print('OK service (CRLF)')
else:
    old_lf = old.replace('\r\n', '\n')
    new_lf = new.replace('\r\n', '\n')
    if old_lf in text:
        text = text.replace(old_lf, new_lf, 1)
        print('OK service (LF)')
    else:
        idx = text.find("this.table('properties').insert")
        print('ERROR service. Current:')
        print(repr(text[idx:idx+300]))

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
