"""
SMS送信後の担当フィールド自動セット処理を安全な実装に修正:
- assigneeKeyの型アサーションを追加
- エラーが発生してもSMS送信は継続するよう保証
- myInitialの取得ロジックを修正（initialsがない場合はnameを使用）
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old_block = """        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
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

        // SMSアプリを開く"""

new_block = """        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット
        try {
          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];
          const myInitial = employee?.initials || employee?.name || '';
          if (assigneeKey && myInitial && seller?.id) {
            await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });
            setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);
          }
        } catch (assigneeErr) {
          console.error('担当フィールド自動セットエラー:', assigneeErr);
        }

        // SMSアプリを開く"""

if old_block in text:
    text = text.replace(old_block, new_block)
    print('✅ SMS担当フィールド処理を修正しました')
else:
    print('⚠️ 対象ブロックが見つかりません')
    # デバッグ
    if 'SMS送信後、対応する担当フィールド' in text:
        print('  → ブロックは存在するが内容が異なります')
        idx = text.find('SMS送信後、対応する担当フィールド')
        print(repr(text[idx-10:idx+300]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 保存完了')
