#!/usr/bin/env python3
# buyer-appointments.ts で sellers の name/phone_number を復号化するよう修正

with open('backend/src/routes/buyer-appointments.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# importに decrypt を追加
old_import = "import { authenticate } from '../middleware/auth';"
new_import = "import { authenticate } from '../middleware/auth';\nimport { decrypt } from '../utils/encryption';"

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ decrypt import を追加しました')
else:
    print('❌ import箇所が見つかりません')

# sellers から取得した name/phone_number を復号化
old_seller = """          if (sellerData) {
            ownerName = sellerData.name || 'なし';
            ownerPhone = sellerData.phone_number || 'なし';
          }"""

new_seller = """          if (sellerData) {
            try {
              ownerName = sellerData.name ? decrypt(sellerData.name) : 'なし';
            } catch {
              ownerName = sellerData.name || 'なし';
            }
            try {
              ownerPhone = sellerData.phone_number ? decrypt(sellerData.phone_number) : 'なし';
            } catch {
              ownerPhone = sellerData.phone_number || 'なし';
            }
          }"""

if old_seller in text:
    text = text.replace(old_seller, new_seller)
    print('✅ sellers の復号化を追加しました')
else:
    print('❌ sellers取得箇所が見つかりません')

with open('backend/src/routes/buyer-appointments.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
