#!/usr/bin/env python3
# emailTemplates.ts の staffInfo 取得ロジックを修正
# sales_assignee が苗字（例: "裏"）の場合も姓名の部分一致で検索できるよう対応

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# StaffManagementService に部分一致検索メソッドを追加するより、
# emailTemplates.ts 側で全スタッフを取得して部分一致検索する方が簡単
old = '''    // スタッフ情報を取得（sales_assignee のイニシャルで検索）
    let staffInfo = null;
    const salesAssignee = property.sales_assignee;
    if (salesAssignee) {
      staffInfo = await staffService.getStaffByInitials(salesAssignee);
    }'''

new = '''    // スタッフ情報を取得（sales_assignee のイニシャルまたは姓名の部分一致で検索）
    let staffInfo = null;
    const salesAssignee = property.sales_assignee;
    if (salesAssignee) {
      // まずイニシャルで完全一致検索
      staffInfo = await staffService.getStaffByInitials(salesAssignee);
      // 見つからない場合は姓名の部分一致で検索（例: "裏" → "裏天真"）
      if (!staffInfo) {
        staffInfo = await staffService.getStaffByNameContains(salesAssignee);
      }
    }'''

if old in text:
    text = text.replace(old, new)
    print('✅ emailTemplates.ts: 部分一致検索を追加')
else:
    print('❌ 対象箇所が見つかりません')
    idx = text.find('getStaffByInitials')
    print(text[max(0,idx-200):idx+200])

with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('emailTemplates.ts 書き込み完了')
