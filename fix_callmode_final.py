with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 1. importにSMS_TEMPLATE_ASSIGNEE_MAPを追加
old_import = "import AssigneeSection from '../components/AssigneeSection';"
new_import = "import AssigneeSection, { SMS_TEMPLATE_ASSIGNEE_MAP } from '../components/AssigneeSection';"
text = text.replace(old_import, new_import)

# 2. SMS送信後の担当フィールド自動セット処理を追加
old_sms = "        setSuccessMessage(`${template.label}を記録しました`);"
new_sms = """        setSuccessMessage(`${template.label}を記録しました`);

        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
        try {
          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
          const myInitial = employee?.initials || employee?.name || '';
          if (assigneeKey && myInitial && seller?.id) {
            await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });
            setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);
          }
        } catch (assigneeErr) {
          console.error('担当フィールド自動セットエラー:', assigneeErr);
        }"""
text = text.replace(old_sms, new_sms)

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('import replaced:', new_import in text)
print('SMS assignee code added:', 'SMS_TEMPLATE_ASSIGNEE_MAP[template.id]' in text)
