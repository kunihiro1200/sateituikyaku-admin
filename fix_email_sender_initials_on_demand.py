#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Email送信時にmyInitialsが空なら/api/employees/initials-by-emailをその場で呼ぶ
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 現在のresolvedSenderInitials計算コードを探す
old_code = (
    "          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n"
    "          // BuyerViewingResultPage\u3068\u540c\u3058\u65b9\u6cd5: employee?.initial || employee?.name\n"
    "          let resolvedSenderInitials = myInitials\n"
    "            || (employee as any)?.initial\n"
    "            || activeEmployees.find(e => e.email === employee?.email)?.initials\n"
    "            || (employee as any)?.initials\n"
    "            || '';\n"
    "          // \u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af: SMS\u3068\u540c\u3058\u65b9\u6cd5\uff08active-initials + getActiveEmployees\uff09\n"
    "          if (!resolvedSenderInitials && employee?.email) {\n"
    "            try {\n"
    "              const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "              const freshMe = freshEmployees.find(e => e.email === employee?.email);\n"
    "              resolvedSenderInitials = freshMe?.initials || '';\n"
    "            } catch { /* ignore */ }\n"
    "          }"
)

new_code = (
    "          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n"
    "          // myInitials\u304c\u8a2d\u5b9a\u6e08\u307f\u306a\u3089\u305d\u308c\u3092\u4f7f\u7528\u3001\u306a\u3051\u308c\u3070\u305d\u306e\u5834\u3067\u53d6\u5f97\n"
    "          let resolvedSenderInitials = myInitials || '';\n"
    "          if (!resolvedSenderInitials) {\n"
    "            // \u305d\u306e\u5834\u3067/api/employees/initials-by-email\u3092\u547c\u3093\u3067\u53d6\u5f97\n"
    "            try {\n"
    "              const initialsRes = await api.get('/api/employees/initials-by-email');\n"
    "              if (initialsRes.data?.initials) {\n"
    "                resolvedSenderInitials = initialsRes.data.initials;\n"
    "                setMyInitials(resolvedSenderInitials); // \u6b21\u56de\u306e\u305f\u3081\u306b\u4fdd\u5b58\n"
    "              }\n"
    "            } catch { /* ignore */ }\n"
    "          }\n"
    "          // \u3055\u3089\u306b\u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af: SMS\u3068\u540c\u3058\u65b9\u6cd5\n"
    "          if (!resolvedSenderInitials && employee?.email) {\n"
    "            try {\n"
    "              const freshEmployees = await import('../services/employeeService').then(m => m.getActiveEmployees());\n"
    "              const freshMe = freshEmployees.find(e => e.email === employee?.email);\n"
    "              resolvedSenderInitials = freshMe?.initials || (employee as any)?.initials || '';\n"
    "            } catch { /* ignore */ }\n"
    "          }"
)

if old_code not in text:
    print('ERROR: \u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('resolvedSenderInitials')
    if idx >= 0:
        print(repr(text[idx-50:idx+600]))
    import sys; sys.exit(1)

text = text.replace(old_code, new_code, 1)
print('OK: Email\u9001\u4fe1\u6642\u306b\u305d\u306e\u5834\u3067\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u53d6\u5f97\u3059\u308b\u3088\u3046\u4fee\u6b63\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
