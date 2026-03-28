#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
除外日にすること の双方向同期バグ修正
column-mapping.json に exclusion_action <-> 除外日にすること のマッピングを追加
"""

with open('src/config/column-mapping.json', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# spreadsheetToDatabase に追加（固定資産税路線価の直前）
old_s2d = '"固定資産税路線価": "fixed_asset_tax_road_price"'
new_s2d = '"除外日にすること": "exclusion_action",\n    "固定資産税路線価": "fixed_asset_tax_road_price"'
text = text.replace(old_s2d, new_s2d)

# databaseToSpreadsheet に追加（fixed_asset_tax_road_price の直前）
old_d2s = '"fixed_asset_tax_road_price": "固定資産税路線価"'
new_d2s = '"exclusion_action": "除外日にすること",\n    "fixed_asset_tax_road_price": "固定資産税路線価"'
text = text.replace(old_d2s, new_d2s)

with open('src/config/column-mapping.json', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ column-mapping.json を修正しました")
print("  - spreadsheetToDatabase: '除外日にすること' -> 'exclusion_action' を追加")
print("  - databaseToSpreadsheet: 'exclusion_action' -> '除外日にすること' を追加")
