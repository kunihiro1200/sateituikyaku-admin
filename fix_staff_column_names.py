#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
StaffManagementService.ts のカラム名を修正する
- row['名字'] → row['姓名']（D列）
- row['メールアドレス'] → row['メアド']（E列）
"""

with open('backend/src/services/StaffManagementService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# カラム名の修正
text = text.replace("const name = row['名字'] as string;", "const name = row['姓名'] as string;")
text = text.replace("const email = row['メールアドレス'] as string | null;", "const email = row['メアド'] as string | null;")

# コメントも更新
text = text.replace(
    " * - C列: 名字\n * - F列: Chat webhook",
    " * - D列: 姓名（担当名）\n * - E列: メアド（メールアドレス）\n * - F列: Chat webhook"
)

with open('backend/src/services/StaffManagementService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! StaffManagementService.ts のカラム名を修正しました')
print('  名字 → 姓名')
print('  メールアドレス → メアド')
