#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePageでページロード時に/api/auth/my-initialsを呼んで
ログインユーザーのイニシャルを取得するよう修正
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# normalInitialsのstate定義の後にmyInitialsのstateを追加
old_state = "  const [normalInitials, setNormalInitials] = useState<string[]>([]); // スプシ「通常=TRUE」のイニシャル一覧"

new_state = (
    "  const [normalInitials, setNormalInitials] = useState<string[]>([]); // スプシ「通常=TRUE」のイニシャル一覧\n"
    "  const [myInitials, setMyInitials] = useState<string>(''); // ログインユーザーのイニシャル"
)

if old_state not in text:
    print('ERROR: normalInitials stateが見つかりません')
    import sys; sys.exit(1)

text = text.replace(old_state, new_state, 1)

# normalInitialsを取得するapi.getの後にmy-initialsの取得を追加
old_fetch = (
    "        api.get('/api/employees/active-initials').then((res) => {\n"
    "          const initials: string[] = res.data?.initials || [];\n"
    "          setNormalInitials(initials);\n"
    "        }).catch((err) => {\n"
    "          console.error('Failed to load normal initials:', err);"
)

new_fetch = (
    "        api.get('/api/employees/active-initials').then((res) => {\n"
    "          const initials: string[] = res.data?.initials || [];\n"
    "          setNormalInitials(initials);\n"
    "        }).catch((err) => {\n"
    "          console.error('Failed to load normal initials:', err);\n"
    "        }),\n"
    "        // ログインユーザーのイニシャルを取得（スプシのスタッフシートから）\n"
    "        api.get('/api/auth/my-initials').then((res) => {\n"
    "          if (res.data?.initials) setMyInitials(res.data.initials);\n"
    "        }).catch(() => { /* ignore */ }),\n"
    "        // ダミー（元のcatch節を維持するため）\n"
    "        Promise.resolve().then(() => {"
)

if old_fetch not in text:
    print('ERROR: active-initialsのfetch箇所が見つかりません')
    idx = text.find("api.get('/api/employees/active-initials')")
    if idx >= 0:
        print(repr(text[idx-50:idx+300]))
    import sys; sys.exit(1)

text = text.replace(old_fetch, new_fetch, 1)

# resolvedSenderInitialsの取得でmyInitialsを最優先に使う
old_resolve = (
    "          // 送信者イニシャルをフロントエンドで解決してバックエンドに渡す\n"
    "          let resolvedSenderInitials = '';\n"
    "          {\n"
    "            // 1. activeEmployeesからメールでマッチング（initialsがあれば使用）\n"
    "            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n"
    "            if (myEmp?.initials) {\n"
    "              resolvedSenderInitials = myEmp.initials;\n"
    "            } else if (employee?.initials) {\n"
    "              resolvedSenderInitials = employee.initials;"
)

new_resolve = (
    "          // 送信者イニシャルをフロントエンドで解決してバックエンドに渡す\n"
    "          let resolvedSenderInitials = '';\n"
    "          {\n"
    "            // 0. myInitials（/api/auth/my-initialsから取得済み）を最優先\n"
    "            if (myInitials) {\n"
    "              resolvedSenderInitials = myInitials;\n"
    "            } else {\n"
    "            // 1. activeEmployeesからメールでマッチング（initialsがあれば使用）\n"
    "            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n"
    "            if (myEmp?.initials) {\n"
    "              resolvedSenderInitials = myEmp.initials;\n"
    "            } else if (employee?.initials) {\n"
    "              resolvedSenderInitials = employee.initials;"
)

if old_resolve not in text:
    print('ERROR: resolvedSenderInitialsの取得箇所が見つかりません')
    idx = text.find('resolvedSenderInitials')
    if idx >= 0:
        print(repr(text[idx-50:idx+400]))
    import sys; sys.exit(1)

# 対応する閉じ括弧も修正が必要
# 元のコードの末尾 "          }" を "            }\n          }" に変更
old_resolve_end = (
    "              resolvedSenderInitials = employee.initials;\n"
    "            } else {\n"
    "              // 3. normalInitials\u306e\u4e2d\u304b\u3089activeEmployees\u3067\u7167\u5408\n"
    "              try {\n"
    "                const freshEmps = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "                const freshMe = freshEmps.find(e => e.email === employee?.email);\n"
    "                if (freshMe?.initials) resolvedSenderInitials = freshMe.initials;\n"
    "              } catch { /* ignore */ }\n"
    "            }\n"
    "          }"
)

new_resolve_end = (
    "              resolvedSenderInitials = employee.initials;\n"
    "            } else {\n"
    "              // 3. normalInitials\u306e\u4e2d\u304b\u3089activeEmployees\u3067\u7167\u5408\n"
    "              try {\n"
    "                const freshEmps = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "                const freshMe = freshEmps.find(e => e.email === employee?.email);\n"
    "                if (freshMe?.initials) resolvedSenderInitials = freshMe.initials;\n"
    "              } catch { /* ignore */ }\n"
    "            }\n"
    "            } // end else (myInitials not available)\n"
    "          }"
)

text = text.replace(old_resolve, new_resolve, 1)

if old_resolve_end in text:
    text = text.replace(old_resolve_end, new_resolve_end, 1)
    print('OK: resolvedSenderInitialsにmyInitialsを最優先で使用するよう修正しました')
else:
    print('WARNING: resolve_end\u306e\u7f6e\u63db\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u304c\u7d9a\u884c\u3057\u307e\u3059')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
