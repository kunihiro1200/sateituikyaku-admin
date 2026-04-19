#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkTaskDetailModal.tsx スクロールバグ根本修正
真の原因: インラインコンポーネント定義による再マウント

解決策: EditableField, EditableButtonSelect, EditableYesNo, ReadOnlyDisplayField,
SectionHeader, RedNote などを WorkTaskDetailModal の外部に定義し、
props 経由でデータを渡す。

これにより editedData が更新されても React はコンポーネントを
再マウントせず、単純な再レンダリングのみ行う。
"""

with open('src/components/WorkTaskDetailModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 修正内容:
# 1. WorkTaskDetailModal 内のインラインコンポーネント定義を
#    モーダルの外部（ファイルのトップレベル）に移動する
# 2. getValue, handleFieldChange, normalInitials, hasChanges, saving, handleSave
#    などを props として渡す
# 3. SiteRegistrationSection も外部化し、必要な props を渡す
# ============================================================

# まず現在のファイル構造を確認
print("=== 現在のファイル行数 ===")
lines = text.split('\n')
print(f"総行数: {len(lines)}")

# インラインコンポーネントの位置を確認
inline_components = [
    'const EditableField = ',
    'const EditableButtonSelect = ',
    'const EditableYesNo = ',
    'const MediationSection = ',
    'const SectionHeader = ',
    'const RedNote = ',
    'const CadastralMapFieldSelect = ',
    'const SiteRegistrationSection = ',
    'const ReadOnlyDisplayField = ',
    'const PreRequestCheckPopup = ',
    'const PreRequestCheckButton = ',
    'const EditableMultilineField = ',
    'const ContractSettlementSection = ',
    'const JudicialScrivenerSection = ',
]

for comp in inline_components:
    for i, line in enumerate(lines):
        if comp in line:
            print(f"  行{i+1}: {line.strip()[:80]}")

print("\n=== WorkTaskDetailModal 関数の開始行 ===")
for i, line in enumerate(lines):
    if 'export default function WorkTaskDetailModal' in line:
        print(f"  行{i+1}: {line.strip()}")
        break
