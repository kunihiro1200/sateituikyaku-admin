#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
resolvedSenderInitialsの取得ロジックを修正
normalInitialsとemployee.nameから確実にイニシャルを取得する
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のresolvedSenderInitials取得ロジック
old_resolve = (
    '          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n'
    "          let resolvedSenderInitials = '';\n"
    '          {\n'
    '            // 1. activeEmployees\u304b\u3089\u30e1\u30fc\u30eb\u3067\u30de\u30c3\u30c1\u30f3\u30b0\n'
    "            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n"
    '            if (myEmp?.initials) {\n'
    '              resolvedSenderInitials = myEmp.initials;\n'
    "            } else if (employee?.initials) {\n"
    '              // 2. authStore\u306eemployee.initials\n'
    '              resolvedSenderInitials = employee.initials;\n'
    '            } else {\n'
    '              // 3. normalInitials\u306e\u4e2d\u304b\u3089activeEmployees\u3067\u7167\u5408\n'
    '              try {\n'
    "                const freshEmps = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "                const freshMe = freshEmps.find(e => e.email === employee?.email);\n"
    '                if (freshMe?.initials) resolvedSenderInitials = freshMe.initials;\n'
    '              } catch { /* ignore */ }\n'
    '            }\n'
    '          }'
)

# 修正後: normalInitialsとactiveEmployeesのnameから確実に取得
new_resolve = (
    '          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n'
    "          let resolvedSenderInitials = '';\n"
    '          {\n'
    '            // 1. activeEmployees\u304b\u3089\u30e1\u30fc\u30eb\u3067\u30de\u30c3\u30c1\u30f3\u30b0\uff08initials\u304c\u3042\u308c\u3070\u4f7f\u7528\uff09\n'
    "            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n"
    '            if (myEmp?.initials) {\n'
    '              resolvedSenderInitials = myEmp.initials;\n'
    "            } else if (employee?.initials) {\n"
    '              resolvedSenderInitials = employee.initials;\n'
    '            } else if (myEmp?.name && normalInitials.length > 0) {\n'
    '              // 2. name\u304b\u3089\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u8a08\u7b97\u3057\u3066normalInitials\u3068\u7167\u5408\n'
    '              // \u59d3\u540d\u306e\u5404\u30d1\u30fc\u30c8\u306e\u5148\u982d\u6587\u5b57\u3092\u7d50\u5408\uff08\u4f8b: "\u56fd\u5e83\u667a\u5b50" \u2192 "\u56fd\u667a" or "K"\uff09\n'
    '              const nameParts = myEmp.name.trim().split(/\\s+/);\n'
    '              const calcInitials = nameParts.map((p: string) => p[0] || \'\').join(\'\').toUpperCase();\n'
    '              if (normalInitials.includes(calcInitials)) {\n'
    '                resolvedSenderInitials = calcInitials;\n'
    '              } else {\n'
    '                // \u30a4\u30cb\u30b7\u30e3\u30eb\u304c1\u6587\u5b57\u306e\u5834\u5408\u3082\u8a66\u3059\n'
    '                const singleInitial = (myEmp.name[0] || \'\').toUpperCase();\n'
    '                if (normalInitials.includes(singleInitial)) {\n'
    '                  resolvedSenderInitials = singleInitial;\n'
    '                }\n'
    '              }\n'
    '            } else if (employee?.name && normalInitials.length > 0) {\n'
    '              // 3. employee.name\u304b\u3089\u8a08\u7b97\n'
    '              const nameParts = employee.name.trim().split(/\\s+/);\n'
    '              const calcInitials = nameParts.map((p: string) => p[0] || \'\').join(\'\').toUpperCase();\n'
    '              if (normalInitials.includes(calcInitials)) {\n'
    '                resolvedSenderInitials = calcInitials;\n'
    '              } else {\n'
    '                const singleInitial = (employee.name[0] || \'\').toUpperCase();\n'
    '                if (normalInitials.includes(singleInitial)) {\n'
    '                  resolvedSenderInitials = singleInitial;\n'
    '                }\n'
    '              }\n'
    '            }\n'
    '          }'
)

if old_resolve not in text:
    print('ERROR: \u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('resolvedSenderInitials')
    if idx >= 0:
        print(repr(text[idx-100:idx+600]))
    import sys; sys.exit(1)

text = text.replace(old_resolve, new_resolve, 1)
print('OK: resolvedSenderInitials\u306e\u53d6\u5f97\u30ed\u30b8\u30c3\u30af\u3092\u4fee\u6b63\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
