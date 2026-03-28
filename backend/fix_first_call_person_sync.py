#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1番電話フィールドの同期バグ修正
EnhancedAutoSyncService.ts の '一番TEL' を '1番電話' に変更（3箇所）
column-mapping.json の spreadsheetToDatabase セクションも修正
"""

import re

# ===== EnhancedAutoSyncService.ts の修正 =====
with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前後の確認
count = text.count("一番TEL")
print(f"修正前: '一番TEL' の出現回数 = {count}")

# 3箇所を '1番電話' に置換
text = text.replace("sheetRow['一番TEL']", "sheetRow['1番電話']")
text = text.replace("row['一番TEL']", "row['1番電話']")

count_after = text.count("一番TEL")
print(f"修正後: '一番TEL' の出現回数 = {count_after}")

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ EnhancedAutoSyncService.ts を修正しました")

# ===== column-mapping.json の修正 =====
with open('src/config/column-mapping.json', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# spreadsheetToDatabase の "一番TEL" を "1番電話" に変更
# databaseToSpreadsheet の "first_call_person": "一番TEL" は変更しない
old = '"一番TEL": "first_call_person"'
new = '"1番電話": "first_call_person"'

if old in text2:
    text2 = text2.replace(old, new)
    print("✅ column-mapping.json の spreadsheetToDatabase を修正しました")
else:
    print("⚠️  column-mapping.json に '一番TEL': 'first_call_person' が見つかりません（既に修正済みか確認してください）")

with open('src/config/column-mapping.json', 'wb') as f:
    f.write(text2.encode('utf-8'))

print("\n修正完了。databaseToSpreadsheet の 'first_call_person': '一番TEL' は意図的に変更していません。")
