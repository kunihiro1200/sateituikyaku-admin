#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重複した import 文を修正するスクリプト"""

file_path = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(file_path, 'rb') as f:
    content = f.read().decode('utf-8')

# 重複している import を1つに修正
old_dup = (
    "import { FollowUpLogHistoryTable } from '../components/FollowUpLogHistoryTable';\r\n"
    "import AssigneeSection from '../components/AssigneeSection';\r\n"
    "import AssigneeSection from '../components/AssigneeSection';"
)
new_single = (
    "import { FollowUpLogHistoryTable } from '../components/FollowUpLogHistoryTable';\r\n"
    "import AssigneeSection from '../components/AssigneeSection';"
)

if old_dup in content:
    content = content.replace(old_dup, new_single, 1)
    print('✅ 重複 import を修正しました')
else:
    # 別パターンを試す
    old_dup2 = (
        "import AssigneeSection from '../components/AssigneeSection';\r\n"
        "import AssigneeSection from '../components/AssigneeSection';"
    )
    if old_dup2 in content:
        content = content.replace(old_dup2, "import AssigneeSection from '../components/AssigneeSection';", 1)
        print('✅ 重複 import を修正しました（パターン2）')
    else:
        print('重複なし、または別パターン')
        # 確認
        count = content.count("import AssigneeSection from '../components/AssigneeSection';")
        print(f'AssigneeSection import の出現回数: {count}')

with open(file_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ 完了')
