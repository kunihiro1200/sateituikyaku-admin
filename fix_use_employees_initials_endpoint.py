#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
/api/auth/my-initials (404) の代わりに /api/employees/initials-by-email を使うよう修正
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前: /api/auth/my-initials を呼んでいる
old_fetch = (
    "        // \u30ed\u30b0\u30a4\u30f3\u30e6\u30fc\u30b6\u30fc\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30b9\u30d7\u30b7\u304b\u3089\u53d6\u5f97\n"
    "        api.get('/api/auth/my-initials').then((res) => {\n"
    "          if (res.data?.initials) setMyInitials(res.data.initials);\n"
    "        }).catch(() => { /* ignore */ }),\n"
    "        // \u30c0\u30df\u30fc\uff08\u5143\u306ecatch\u7bc0\u3092\u7dad\u6301\u3059\u308b\u305f\u3081\uff09\n"
    "        Promise.resolve().then(() => {"
)

# 修正後: /api/employees/initials-by-email を使う
new_fetch = (
    "        // \u30ed\u30b0\u30a4\u30f3\u30e6\u30fc\u30b6\u30fc\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u30b9\u30d7\u30b7\u304b\u3089\u53d6\u5f97\uff08\u78ba\u5b9f\u306a\u30a8\u30f3\u30c9\u30dd\u30a4\u30f3\u30c8\uff09\n"
    "        api.get('/api/employees/initials-by-email').then((res) => {\n"
    "          if (res.data?.initials) setMyInitials(res.data.initials);\n"
    "        }).catch(() => { /* ignore */ }),\n"
    "        // \u30c0\u30df\u30fc\uff08\u5143\u306ecatch\u7bc0\u3092\u7dad\u6301\u3059\u308b\u305f\u3081\uff09\n"
    "        Promise.resolve().then(() => {"
)

if old_fetch not in text:
    print('ERROR: /api/auth/my-initials\u306e\u547c\u3073\u51fa\u3057\u7b87\u6240\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('api/auth/my-initials')
    if idx >= 0:
        print(repr(text[idx-100:idx+200]))
    import sys; sys.exit(1)

text = text.replace(old_fetch, new_fetch, 1)
print('OK: /api/employees/initials-by-email\u306b\u5909\u66f4\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
