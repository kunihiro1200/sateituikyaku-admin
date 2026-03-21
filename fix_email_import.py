with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "import AssigneeSection, { SMS_TEMPLATE_ASSIGNEE_MAP } from '../components/AssigneeSection';"
new = "import AssigneeSection, { SMS_TEMPLATE_ASSIGNEE_MAP, EMAIL_TEMPLATE_ASSIGNEE_MAP } from '../components/AssigneeSection';"

if old in text:
    text = text.replace(old, new)
    print('✅ インポート修正成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
