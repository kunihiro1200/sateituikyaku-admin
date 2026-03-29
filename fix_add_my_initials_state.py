#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
myInitials stateを追加し、ページロード時に/api/auth/my-initialsから取得する
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. myInitials stateを追加
old_state = "  const [normalInitials, setNormalInitials] = useState<string[]>([]); // \u30b9\u30d7\u30b7\u300c\u901a\u5e38=TRUE\u300d\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u4e00\u89a7"
new_state = (
    "  const [normalInitials, setNormalInitials] = useState<string[]>([]); // \u30b9\u30d7\u30b7\u300c\u901a\u5e38=TRUE\u300d\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u4e00\u89a7\n"
    "  const [myInitials, setMyInitials] = useState<string>(''); // \u30ed\u30b0\u30a4\u30f3\u30e6\u30fc\u30b6\u30fc\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\uff08\u30b9\u30d7\u30b7\u304b\u3089\u53d6\u5f97\uff09"
)

if old_state not in text:
    print('ERROR: normalInitials state\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    import sys; sys.exit(1)

text = text.replace(old_state, new_state, 1)
print('OK: myInitials state\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f')

# 2. normalInitialsを取得するapi.getの後にmy-initialsの取得を追加
# "setNormalInitials(initials);" の後に追加
old_fetch = "          setNormalInitials(initials);\n        }).catch((err) => {\n          console.error('Failed to load normal initials:', err);"
new_fetch = (
    "          setNormalInitials(initials);\n"
    "        }).catch((err) => {\n"
    "          console.error('Failed to load normal initials:', err);\n"
    "        }),\n"
    "        // \u30ed\u30b0\u30a4\u30f3\u30e6\u30fc\u30b6\u30fc\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30b9\u30d7\u30b7\u304b\u3089\u53d6\u5f97\n"
    "        api.get('/api/auth/my-initials').then((res) => {\n"
    "          if (res.data?.initials) setMyInitials(res.data.initials);\n"
    "        }).catch(() => { /* ignore */ }),\n"
    "        // \u30c0\u30df\u30fc\uff08\u5143\u306ecatch\u7bc0\u3092\u7dad\u6301\u3059\u308b\u305f\u3081\uff09\n"
    "        Promise.resolve().then(() => {"
)

if old_fetch not in text:
    print('ERROR: setNormalInitials\u306e\u5f8c\u306e\u7f6e\u63db\u7b87\u6240\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('setNormalInitials(initials)')
    if idx >= 0:
        print(repr(text[idx-50:idx+200]))
    import sys; sys.exit(1)

text = text.replace(old_fetch, new_fetch, 1)
print('OK: my-initials\u306e\u53d6\u5f97\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f')

# 3. resolvedSenderInitialsでmyInitialsを最優先に使う
old_resolve = (
    "          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n"
    "          let resolvedSenderInitials = '';\n"
    "          {\n"
    "            // 1. activeEmployees\u304b\u3089\u30e1\u30fc\u30eb\u3067\u30de\u30c3\u30c1\u30f3\u30b0\n"
    "            const myEmp = activeEmployees.find(e => e.email === employee?.email);\n"
    "            if (myEmp?.initials) {\n"
    "              resolvedSenderInitials = myEmp.initials;\n"
    "            } else if (employee?.initials) {\n"
    "              // 2. authStore\u306eemployee.initials\n"
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

new_resolve = (
    "          // \u9001\u4fe1\u8005\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u89e3\u6c7a\u3057\u3066\u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u306b\u6e21\u3059\n"
    "          // myInitials\uff08\u30da\u30fc\u30b8\u30ed\u30fc\u30c9\u6642\u306b/api/auth/my-initials\u304b\u3089\u53d6\u5f97\u6e08\u307f\uff09\u3092\u6700\u512a\u5148\u3067\u4f7f\u7528\n"
    "          const resolvedSenderInitials = myInitials\n"
    "            || activeEmployees.find(e => e.email === employee?.email)?.initials\n"
    "            || (employee as any)?.initials\n"
    "            || '';"
)

if old_resolve not in text:
    print('ERROR: resolvedSenderInitials\u306e\u7f6e\u63db\u7b87\u6240\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('let resolvedSenderInitials')
    if idx >= 0:
        print(repr(text[idx-50:idx+600]))
    import sys; sys.exit(1)

text = text.replace(old_resolve, new_resolve, 1)
print('OK: resolvedSenderInitials\u306b\u30b9\u30d7\u30b7\u304b\u3089\u53d6\u5f97\u3057\u305f\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u6700\u512a\u5148\u3067\u4f7f\u7528\u3059\u308b\u3088\u3046\u4fee\u6b63\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
