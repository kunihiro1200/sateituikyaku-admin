#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CallModePage.tsx に AssigneeSection を追加するスクリプト（CRLF対応）"""

file_path = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(file_path, 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8')

# 1. import 文を追加（FollowUpLogHistoryTable の import の直後）
old_import = "import { FollowUpLogHistoryTable } from '../components/FollowUpLogHistoryTable';"
new_import = (
    "import { FollowUpLogHistoryTable } from '../components/FollowUpLogHistoryTable';\r\n"
    "import AssigneeSection from '../components/AssigneeSection';"
)

if old_import not in content:
    print('❌ import 文が見つかりません')
    exit(1)

content = content.replace(old_import, new_import, 1)
print('✅ import 文を追加しました')

# 2. FollowUpLogHistoryTable の直上に AssigneeSection を挿入
# CRLF を使用して検索
old_section = (
    "            {/* 追客ログ履歴（APPSHEET） */}\r\n"
    "            {seller?.sellerNumber && (\r\n"
    "              <FollowUpLogHistoryTable sellerNumber={seller.sellerNumber} />\r\n"
    "            )}"
)
new_section = (
    "            {/* 担当者設定セクション */}\r\n"
    "            {seller && (\r\n"
    "              <AssigneeSection\r\n"
    "                seller={seller}\r\n"
    "                onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}\r\n"
    "              />\r\n"
    "            )}\r\n"
    "\r\n"
    "            {/* 追客ログ履歴（APPSHEET） */}\r\n"
    "            {seller?.sellerNumber && (\r\n"
    "              <FollowUpLogHistoryTable sellerNumber={seller.sellerNumber} />\r\n"
    "            )}"
)

if old_section not in content:
    print('❌ FollowUpLogHistoryTable の挿入箇所が見つかりません')
    # デバッグ: 実際の文字列を確認
    idx = content.find('追客ログ履歴')
    if idx >= 0:
        print('実際の文字列:', repr(content[idx-5:idx+200]))
    exit(1)

content = content.replace(old_section, new_section, 1)
print('✅ AssigneeSection を挿入しました')

with open(file_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'✅ {file_path} を更新しました')

# BOM チェック
with open(file_path, 'rb') as f:
    head = f.read(3)
print(f'BOM check: {repr(head[:3])}')
