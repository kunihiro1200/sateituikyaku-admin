"""
CallModePage.tsx の変更:
1. SMS_TEMPLATE_ASSIGNEE_MAP を AssigneeSection からインポート
2. SMS送信後、対応フィールドにログインユーザーのイニシャルを自動セット
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 1. AssigneeSectionのimportに SMS_TEMPLATE_ASSIGNEE_MAP を追加
old_import = "import AssigneeSection from '../components/AssigneeSection';"
new_import = "import AssigneeSection, { SMS_TEMPLATE_ASSIGNEE_MAP } from '../components/AssigneeSection';"
text = text.replace(old_import, new_import)

# 2. SMS送信後に担当フィールドを自動セット
# 対象ブロック: type === 'sms' の中の setSuccessMessage の後
old_sms_block = """        setSuccessMessage(`${template.label}を記録しました`);

        // SMSアプリを開く
        if (seller?.phoneNumber) {
          const smsLink = `sms:${seller.phoneNumber}?body=${encodeURIComponent(messageContent)}`;
          window.location.href = smsLink;
        }"""

new_sms_block = """        setSuccessMessage(`${template.label}を記録しました`);

        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
        const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
        const myInitial = employee?.initials || employee?.name || '';
        if (assigneeKey && myInitial && seller?.id) {
          try {
            await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });
            setSeller((prev) => prev ? { ...prev, [assigneeKey]: myInitial } : prev);
          } catch (assigneeErr) {
            console.error('担当フィールド自動セットエラー:', assigneeErr);
          }
        }

        // SMSアプリを開く
        if (seller?.phoneNumber) {
          const smsLink = `sms:${seller.phoneNumber}?body=${encodeURIComponent(messageContent)}`;
          window.location.href = smsLink;
        }"""

if old_sms_block in text:
    text = text.replace(old_sms_block, new_sms_block)
    print('✅ SMS送信後の担当フィールド自動セット処理を追加しました')
else:
    print('⚠️ SMS送信ブロックが見つかりません。手動確認が必要です。')
    # デバッグ: 周辺を確認
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if 'を記録しました' in line:
            print(f'  Line {i+1}: {line}')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ CallModePage.tsx を保存しました')

# 確認
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

if 'SMS_TEMPLATE_ASSIGNEE_MAP' in verify:
    print('✅ SMS_TEMPLATE_ASSIGNEE_MAP インポート: OK')
if '担当フィールド自動セット' in verify:
    print('✅ 担当フィールド自動セット処理: OK')
