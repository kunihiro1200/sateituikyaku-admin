import re

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 修正前
old = (
    "        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット\n"
    "        try {\n"
    "          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];\n"
    "          const myInitial = employee?.initials || employee?.name || '';\n"
    "          if (assigneeKey && myInitial && seller?.id) {\n"
    "            await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });\n"
    "            setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n"
    "          }\n"
    "        } catch (assigneeErr) {\n"
    "          console.error('担当フィールド自動セットエラー:', assigneeErr);\n"
    "        }"
)

# 修正後: activeEmployeesからログインユーザーのイニシャルを照合
new = (
    "        // SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット\n"
    "        try {\n"
    "          const assigneeKey = SMS_TEMPLATE_ASSIGNEE_MAP[template.id];\n"
    "          // activeEmployeesからログインユーザーのメールでイニシャルを照合（最優先）\n"
    "          // employee.initialsはlocalStorageキャッシュで古い場合があるため\n"
    "          const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n"
    "          const myInitial = myEmployee?.initials || employee?.initials || '';\n"
    "          if (assigneeKey && myInitial && seller?.id) {\n"
    "            await api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial });\n"
    "            setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n"
    "          }\n"
    "        } catch (assigneeErr) {\n"
    "          console.error('担当フィールド自動セットエラー:', assigneeErr);\n"
    "        }"
)

if old not in text:
    print('ERROR: 対象文字列が見つかりません')
    # デバッグ用に周辺を表示
    idx = text.find('SMS送信後、対応する担当フィールドにログインユーザーのイニシャルを自動セット')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-10:idx+300]))
    else:
        print('キーワードも見つかりません')
else:
    text = text.replace(old, new, 1)
    with open(filepath, 'wb') as f:
        f.write(text.encode('utf-8'))
    print('修正完了')
