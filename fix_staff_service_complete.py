"""
StaffManagementService.ts を完全修正（CRLF対応）:
1. StaffInfo インターフェースに isActive: boolean を追加
2. fetchStaffData() で H列「有効」を読んで isActive をセット
"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

# CRLF -> LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 1. StaffInfo インターフェースに isActive を追加
old_interface = "export interface StaffInfo {\n  initials: string;\n  name: string;\n  chatWebhook: string | null;\n}"
new_interface = "export interface StaffInfo {\n  initials: string;\n  name: string;\n  chatWebhook: string | null;\n  isActive: boolean;\n}"

if old_interface in text:
    text = text.replace(old_interface, new_interface)
    print('✅ StaffInfo インターフェースに isActive を追加')
else:
    print('⚠️ StaffInfo インターフェースが見つかりません')
    idx = text.find('StaffInfo')
    print('周辺:', repr(text[idx:idx+200]))

# 2. fetchStaffData() の staff オブジェクト生成部分を修正
old_fetch = "      if (initials || name) {\n        const staff: StaffInfo = {\n          initials: initials || '',\n          name: name || '',\n          chatWebhook: chatWebhook || null,\n        };"
new_fetch = "      const isActiveRaw = row['有効'];\n      const isActive = isActiveRaw === true || String(isActiveRaw).toUpperCase() === 'TRUE';\n\n      if (initials || name) {\n        const staff: StaffInfo = {\n          initials: initials || '',\n          name: name || '',\n          chatWebhook: chatWebhook || null,\n          isActive,\n        };"

if old_fetch in text:
    text = text.replace(old_fetch, new_fetch)
    print('✅ fetchStaffData() に isActive 読み取りを追加')
else:
    print('⚠️ fetchStaffData() の対象箇所が見つかりません')
    idx = text.find('if (initials || name)')
    if idx >= 0:
        print('周辺テキスト:', repr(text[idx-200:idx+300]))

# 3. スプレッドシート構造コメントに H列を追加
old_comment = " * スプレッドシート構造:\n * - A列: イニシャル\n * - C列: 名字\n * - F列: Chat webhook"
new_comment = " * スプレッドシート構造:\n * - A列: イニシャル\n * - C列: 名字\n * - F列: Chat webhook\n * - H列: 有効（TRUE/FALSE）"

if old_comment in text:
    text = text.replace(old_comment, new_comment)
    print('✅ コメントに H列を追加')
else:
    print('⚠️ コメントが見つかりません')

# LF のまま UTF-8 で書き込む
with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ StaffManagementService.ts の修正完了')

# 確認
with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    result = f.read().decode('utf-8')

# isActive が含まれているか確認
if 'isActive' in result:
    print('✅ isActive が含まれています')
else:
    print('❌ isActive が含まれていません')

if "row['有効']" in result:
    print("✅ row['有効'] が含まれています")
else:
    print("❌ row['有効'] が含まれていません")
