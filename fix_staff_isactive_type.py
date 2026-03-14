"""
StaffManagementService.ts の isActive 型エラーを修正
isActiveRaw === true の比較を削除し、文字列比較のみにする
"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old_line = "      const isActive = isActiveRaw === true || String(isActiveRaw).toUpperCase() === 'TRUE';"
new_line = "      const isActive = String(isActiveRaw).toUpperCase() === 'TRUE';"

if old_line in text:
    text = text.replace(old_line, new_line)
    print('✅ isActive 型エラーを修正')
else:
    print('⚠️ 対象行が見つかりません')

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
