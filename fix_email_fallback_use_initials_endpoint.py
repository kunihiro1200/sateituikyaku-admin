#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email送信後のフォールバック処理で/api/employees/initials-by-emailを使う
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# フォールバック内のmyInitial取得コードを修正
old_fallback = (
    "              if (!autoInitial) {\n"
    "                const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n"
    "                let myInitial = '';\n"
    "                const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n"
    "                if (myEmployee?.initials) {\n"
    "                  myInitial = myEmployee.initials;\n"
    "                } else {\n"
    "                  try {\n"
    "                    const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "                    const freshMe = freshEmployees.find(e => e.email === employee?.email);\n"
    "                    myInitial = freshMe?.initials || employee?.initials || '';\n"
    "                  } catch {\n"
    "                    myInitial = employee?.initials || '';\n"
    "                  }\n"
    "                }\n"
    "                if (assigneeKey && myInitial && seller?.id) {\n"
    "                  promises.push(\n"
    "                    api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial }).then(() => {\n"
    "                      setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n"
    "                    })\n"
    "                  );\n"
    "                }\n"
    "              }"
)

new_fallback = (
    "              if (!autoInitial) {\n"
    "                const assigneeKey = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n"
    "                let myInitial = '';\n"
    "                // \u6700\u512a\u5148: /api/employees/initials-by-email\u3067\u78ba\u5b9f\u306b\u53d6\u5f97\n"
    "                try {\n"
    "                  const initialsRes = await api.get('/api/employees/initials-by-email');\n"
    "                  if (initialsRes.data?.initials) myInitial = initialsRes.data.initials;\n"
    "                } catch { /* ignore */ }\n"
    "                // \u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af: activeEmployees\u304b\u3089\u53d6\u5f97\n"
    "                if (!myInitial) {\n"
    "                  const myEmployee = activeEmployees.find(e => e.email === employee?.email);\n"
    "                  if (myEmployee?.initials) {\n"
    "                    myInitial = myEmployee.initials;\n"
    "                  } else {\n"
    "                    try {\n"
    "                      const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "                      const freshMe = freshEmployees.find(e => e.email === employee?.email);\n"
    "                      myInitial = freshMe?.initials || (employee as any)?.initials || '';\n"
    "                    } catch {\n"
    "                      myInitial = (employee as any)?.initials || '';\n"
    "                    }\n"
    "                  }\n"
    "                }\n"
    "                if (assigneeKey && myInitial && seller?.id) {\n"
    "                  promises.push(\n"
    "                    api.put(`/api/sellers/${seller.id}`, { [assigneeKey]: myInitial }).then(() => {\n"
    "                      setSeller((prev) => prev ? { ...prev, [assigneeKey as keyof Seller]: myInitial } : prev);\n"
    "                    })\n"
    "                  );\n"
    "                }\n"
    "              }"
)

if old_fallback not in text:
    print('ERROR: \u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af\u306e\u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('if (!autoInitial)')
    if idx >= 0:
        print(repr(text[idx:idx+800]))
    import sys; sys.exit(1)

text = text.replace(old_fallback, new_fallback, 1)
print('OK: \u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af\u3067/api/employees/initials-by-email\u3092\u4f7f\u7528\u3059\u308b\u3088\u3046\u4fee\u6b63\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
