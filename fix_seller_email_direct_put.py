#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
売主側のEmail送信後に直接api.putでvisitReminderAssigneeを保存する
バックエンド経由を諦めて、買主側と同じ方式に変更
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Email送信後のautoInitial処理とバックグラウンド処理を修正
# autoInitialが空でも、直接api.putを呼ぶ
old_after_send = (
    "          // \u6d3b\u52d5\u5c65\u6b74\u306e\u4fdd\u5b58\u30fb\u62c5\u5f53\u30d5\u30a3\u30fc\u30eb\u30c9\u66f4\u65b0\u30fb\u518d\u53d6\u5f97\u306f\u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u5b9f\u884c\uff08UI\u3092\u30d6\u30ed\u30c3\u30af\u3057\u306a\u3044\uff09\n"
    "          // \u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u304c\u61c9\u7b54\u8005\u3092\u81ea\u52d5\u30bb\u30c3\u30c8\u6e08\u307f\u306a\u306e\u3067\u3001\u30ec\u30b9\u30dd\u30f3\u30b9\u3067UI\u3092\u66f4\u65b0\n"
    "          const { senderInitials: autoInitial, assigneeKey: autoAssigneeKey } = emailResponse.data || {};\n"
    "          if (autoAssigneeKey && autoInitial && seller) {\n"
    "            setSeller((prev) => prev ? { ...prev, [autoAssigneeKey as keyof Seller]: autoInitial } : prev);\n"
    "          }"
)

new_after_send = (
    "          // \u6d3b\u52d5\u5c65\u6b74\u306e\u4fdd\u5b58\u30fb\u62c5\u5f53\u30d5\u30a3\u30fc\u30eb\u30c9\u66f4\u65b0\u30fb\u518d\u53d6\u5f97\u306f\u30d0\u30c3\u30af\u30b0\u30e9\u30a6\u30f3\u30c9\u3067\u5b9f\u884c\uff08UI\u3092\u30d6\u30ed\u30c3\u30af\u3057\u306a\u3044\uff09\n"
    "          // \u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u304c\u61c9\u7b54\u8005\u3092\u81ea\u52d5\u30bb\u30c3\u30c8\u6e08\u307f\u306a\u3089\u30ec\u30b9\u30dd\u30f3\u30b9\u3067UI\u3092\u66f4\u65b0\n"
    "          const { senderInitials: autoInitial, assigneeKey: autoAssigneeKey } = emailResponse.data || {};\n"
    "          if (autoAssigneeKey && autoInitial && seller) {\n"
    "            setSeller((prev) => prev ? { ...prev, [autoAssigneeKey as keyof Seller]: autoInitial } : prev);\n"
    "          }\n"
    "          // \u30d0\u30c3\u30af\u30a8\u30f3\u30c9\u304c\u30a4\u30cb\u30b7\u30e3\u30eb\u3092\u53d6\u5f97\u3067\u304d\u306a\u304b\u3063\u305f\u5834\u5408\u3001\u30d5\u30ed\u30f3\u30c8\u30a8\u30f3\u30c9\u3067\u76f4\u63a5\u4fdd\u5b58\uff08\u8cb7\u4e3b\u5074\u3068\u540c\u3058\u65b9\u5f0f\uff09\n"
    "          if (!autoInitial) {\n"
    "            const assigneeKeyForDirect = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];\n"
    "            if (assigneeKeyForDirect && seller?.id) {\n"
    "              try {\n"
    "                const initialsRes = await api.get('/api/employees/initials-by-email');\n"
    "                const directInitial = initialsRes.data?.initials || '';\n"
    "                if (directInitial) {\n"
    "                  await api.put(`/api/sellers/${seller.id}`, { [assigneeKeyForDirect]: directInitial });\n"
    "                  setSeller((prev) => prev ? { ...prev, [assigneeKeyForDirect as keyof Seller]: directInitial } : prev);\n"
    "                }\n"
    "              } catch { /* ignore */ }\n"
    "            }\n"
    "          }"
)

if old_after_send not in text:
    print('ERROR: \u5bfe\u8c61\u30b3\u30fc\u30c9\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093')
    idx = text.find('autoAssigneeKey && autoInitial && seller')
    if idx >= 0:
        print(repr(text[idx-200:idx+300]))
    import sys; sys.exit(1)

text = text.replace(old_after_send, new_after_send, 1)
print('OK: Email\u9001\u4fe1\u5f8c\u306b\u76f4\u63a5api.put\u3067\u4fdd\u5b58\u3059\u308b\u3088\u3046\u4fee\u6b63\u3057\u307e\u3057\u305f')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

with open(filepath, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head)} (should NOT be b"\\xef\\xbb\\xbf")')
print('Done!')
