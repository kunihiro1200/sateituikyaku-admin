#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
handleConfirmSend内のmyInitial取得ロジックを修正するスクリプト
normalInitialsを使ったフォールバックを追加
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード（email担当フィールド自動セット部分）
old_code = (
    '              // 担当フィールドにログインユーザーのイニシャルを自動セット\n'
    '              const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n'
    '              let myInitial = \'\';\n'
    '              const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n'
    '              if (myEmployee?.initials) {\n'
    '                myInitial = myEmployee.initials;\n'
    '              } else {\n'
    '                try {\n'
    '                  const freshEmployees = await import(\'../services/employeeService\').then(m => m.getActiveEmployees());\n'
    '                  const freshMe = freshEmployees.find(e => e.email === employee?.email);\n'
    '                  myInitial = freshMe?.initials || employee?.initials || \'\';\n'
    '                } catch {\n'
    '                  myInitial = employee?.initials || \'\';\n'
    '                }\n'
    '              }'
)

# 修正後のコード
# normalInitialsを使ったフォールバックを追加
# activeEmployeesのinitialsがnormalInitialsに含まれているか確認することで
# スプシの「通常=TRUE」スタッフのイニシャルを確実に取得する
new_code = (
    '              // 担当フィールドにログインユーザーのイニシャルを自動セット\n'
    '              const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n'
    '              let myInitial = \'\';\n'
    '              // 1. activeEmployeesからメールでマッチング\n'
    '              const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n'
    '              if (myEmployee?.initials) {\n'
    '                myInitial = myEmployee.initials;\n'
    '              } else {\n'
    '                try {\n'
    '                  // 2. フォールバック: employeeServiceから再取得\n'
    '                  const freshEmployees = await import(\'../services/employeeService\').then(m => m.getActiveEmployees());\n'
    '                  const freshMe = freshEmployees.find(e => e.email === employee?.email);\n'
    '                  myInitial = freshMe?.initials || employee?.initials || \'\';\n'
    '                } catch {\n'
    '                  myInitial = employee?.initials || \'\';\n'
    '                }\n'
    '              }\n'
    '              // 3. 最終フォールバック: normalInitialsの中からactiveEmployeesで照合\n'
    '              // （DBのinitialsカラムが未設定の場合でも動作するよう保険）\n'
    '              if (!myInitial && normalInitials.length > 0) {\n'
    '                try {\n'
    '                  const freshEmployees2 = await import(\'../services/employeeService\').then(m => m.getActiveEmployees());\n'
    '                  const matchedEmp = freshEmployees2.find(e => e.email === employee?.email);\n'
    '                  if (matchedEmp?.initials && normalInitials.includes(matchedEmp.initials)) {\n'
    '                    myInitial = matchedEmp.initials;\n'
    '                  }\n'
    '                } catch { /* ignore */ }\n'
    '              }'
)

if old_code not in text:
    print('ERROR: 対象コードが見つかりません')
    # デバッグ: 周辺を確認
    idx = text.find('EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id]')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-100:idx+500]))
    import sys; sys.exit(1)

text = text.replace(old_code, new_code, 1)

print('OK: myInitial取得ロジックを修正しました')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

# BOMチェック
with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
