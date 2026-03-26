with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# propertiesテーブルのaddress -> property_address
old = "      address: data.property.address,\r\n      prefecture: data.property.prefecture,"
new = "      property_address: data.property.address,\r\n      prefecture: data.property.prefecture,"

if old in text:
    text = text.replace(old, new, 1)
    print('OK (CRLF)')
else:
    old_lf = old.replace('\r\n', '\n')
    new_lf = new.replace('\r\n', '\n')
    if old_lf in text:
        text = text.replace(old_lf, new_lf, 1)
        print('OK (LF)')
    else:
        print('ERROR: not found')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
