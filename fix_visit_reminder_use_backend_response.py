#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
handleConfirmSend内でバックエンドのレスポンス(senderInitials/assigneeKey)を
使ってsetSellerを更新するよう修正するスクリプト
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前: awaitしていない
old_send = "          await api.post(`/api/sellers/${id}/send-template-email`, requestPayload);"

# 修正後: レスポンスを受け取る
new_send = "          const emailResponse = await api.post(`/api/sellers/${id}/send-template-email`, requestPayload);"

if old_send not in text:
    print('ERROR: send-template-email の呼び出し箇所が見つかりません')
    import sys; sys.exit(1)

text = text.replace(old_send, new_send, 1)

# 修正前: バックグラウンド処理でmyInitialを取得してPUT
old_bg = (
    '          // 活動履歴の保存・担当フィールド更新・再取得はバックグラウンドで実行（UIをブロックしない）\n'
    '          (async () => {\n'
    '            try {\n'
    '              // 活動履歴を記録\n'
    '              await api.post(`/api/sellers/${id}/activities`, {\n'
    "                type: 'email',\n"
    '                content: `【${template.label}】を送信`,\n'
    "                result: 'sent',\n"
    '              });\n'
    '\n'
    '              // 担当フィールドにログインユーザーのイニシャルを自動セット\n'
    '              const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n'
    "              let myInitial = '';\n"
    '              const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n'
    '              if (myEmployee?.initials) {\n'
    '                myInitial = myEmployee.initials;\n'
    '              } else {\n'
    '                try {\n'
    "                  const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    '                  const freshMe = freshEmployees.find(e => e.email === employee?.email);\n'
    "                  myInitial = freshMe?.initials || employee?.initials || '';\n"
    '                } catch {\n'
    "                  myInitial = employee?.initials || '';\n"
    '                }\n'
    '              }\n'
    '\n'
    '              // 活動履歴保存 + 担当フィールド更新を並列実行\n'
    '              const promises: Promise<any>[] = [];\n'
    '              if (assigneeKey && myInitial && seller?.id) {\n'
    '                promises.push(\n'
    '                  api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial }).then(() => {\n'
    '                    setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n'
    '                  })\n'
    '                );\n'
    '              }'
)

new_bg = (
    '          // 活動履歴の保存・担当フィールド更新・再取得はバックグラウンドで実行（UIをブロックしない）\n'
    '          // バックエンドがassigneeを自動セット済みなので、レスポンスでUIを更新\n'
    '          const { senderInitials: autoInitial, assigneeKey: autoAssigneeKey } = emailResponse.data || {};\n'
    '          if (autoAssigneeKey && autoInitial && seller) {\n'
    '            setSeller((prev) => prev ? { ...prev, [autoAssigneeKey as keyof Seller]: autoInitial } : prev);\n'
    '          }\n'
    '          (async () => {\n'
    '            try {\n'
    '              // 活動履歴を記録\n'
    '              await api.post(`/api/sellers/${id}/activities`, {\n'
    "                type: 'email',\n"
    '                content: `【${template.label}】を送信`,\n'
    "                result: 'sent',\n"
    '              });\n'
    '\n'
    '              // 活動履歴保存後の並列処理\n'
    '              const promises: Promise<any>[] = [];\n'
    '              // バックエンドで既にassigneeをセット済みのため、フロントエンドでの重複PUTは不要\n'
    '              // （フォールバック: バックエンドがinitialsを持っていない場合のみ実行）\n'
    '              if (!autoInitial) {\n'
    '                const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n'
    "                let myInitial = '';\n"
    '                const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n'
    '                if (myEmployee?.initials) {\n'
    '                  myInitial = myEmployee.initials;\n'
    '                } else {\n'
    '                  try {\n'
    "                    const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    '                    const freshMe = freshEmployees.find(e => e.email === employee?.email);\n'
    "                    myInitial = freshMe?.initials || employee?.initials || '';\n"
    '                  } catch {\n'
    "                    myInitial = employee?.initials || '';\n"
    '                  }\n'
    '                }\n'
    '                if (assigneeKey && myInitial && seller?.id) {\n'
    '                  promises.push(\n'
    '                    api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial }).then(() => {\n'
    '                      setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n'
    '                    })\n'
    '                  );\n'
    '                }\n'
    '              }'
)

if old_bg not in text:
    print('ERROR: バックグラウンド処理の対象コードが見つかりません')
    # デバッグ
    idx = text.find('活動履歴の保存・担当フィールド更新')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx:idx+800]))
    import sys; sys.exit(1)

text = text.replace(old_bg, new_bg, 1)

print('OK: バックエンドレスポンスを使ったsetSeller更新に修正しました')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

# BOMチェック
with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
