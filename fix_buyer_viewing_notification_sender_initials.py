#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPageのonEmailSentでイニシャルを正しく取得するよう修正
"""

filepath = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = (
    "                  onEmailSent={async () => {\n"
    "                    // \u30e1\u30fc\u30eb\u9001\u4fe1\u5f8c\u3001\u30ed\u30b0\u30a4\u30f3\u4e2d\u306e\u30b9\u30bf\u30c3\u30d5\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u901a\u77e5\u9001\u4fe1\u8005\u306b\u81ea\u52d5\u8a2d\u5b9a\n"
    "                    const senderInitial = employee?.initial || employee?.name || '';\n"
    "                    if (senderInitial) {\n"
    "                      await handleInlineFieldSave('notification_sender', senderInitial);\n"
    "                    }\n"
    "                  }}"
)

new_code = (
    "                  onEmailSent={async () => {\n"
    "                    // \u30e1\u30fc\u30eb\u9001\u4fe1\u5f8c\u3001\u30ed\u30b0\u30a4\u30f3\u4e2d\u306e\u30b9\u30bf\u30c3\u30d5\u306e\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u901a\u77e5\u9001\u4fe1\u8005\u306b\u81ea\u52d5\u8a2d\u5b9a\n"
    "                    // /api/employees/initials-by-email\u3067\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u53d6\u5f97\uff08\u30b9\u30d7\u30b7\u304b\u3089\u78ba\u5b9f\u306b\u53d6\u5f97\uff09\n"
    "                    let senderInitial = '';\n"
    "                    try {\n"
    "                      const res = await api.get('/api/employees/initials-by-email');\n"
    "                      senderInitial = res.data?.initials || '';\n"
    "                    } catch { /* ignore */ }\n"
    "                    // \u30d5\u30a9\u30fc\u30eb\u30d0\u30c3\u30af: employee.initial\u307e\u305f\u306ename\u3092\u4f7f\u7528\n"
    "                    if (!senderInitial) senderInitial = (employee as any)?.initial || '';\n"
    "                    if (senderInitial) {\n"
    "                      await handleInlineFieldSave('notification_sender', senderInitial);\n"
    "                    }\n"
    "                  }}"
)

if old_code not in text:
    print('ERROR: \u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('onEmailSent')
    if idx >= 0:
        print(repr(text[idx:idx+300]))
    import sys; sys.exit(1)

text = text.replace(old_code, new_code, 1)
print('OK: \u30a4\u30cb\u30b7\u30e3\u30eb\u53d6\u5f97\u3092/api/employees/initials-by-email\u306b\u5909\u66f4\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
