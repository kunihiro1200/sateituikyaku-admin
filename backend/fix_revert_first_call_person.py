#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1番電話 → 一番TEL に戻す（スプレッドシートの実際のカラム名は「一番TEL」が正しい）
"""

# ===== EnhancedAutoSyncService.ts の修正を元に戻す =====
with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

text = text.replace("sheetRow['1番電話']", "sheetRow['一番TEL']")
text = text.replace("row['1番電話']", "row['一番TEL']")

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ EnhancedAutoSyncService.ts を元に戻しました")

# ===== column-mapping.json の修正を元に戻す =====
with open('src/config/column-mapping.json', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

text2 = text2.replace('"1番電話": "first_call_person"', '"一番TEL": "first_call_person"')

with open('src/config/column-mapping.json', 'wb') as f:
    f.write(text2.encode('utf-8'))

print("✅ column-mapping.json を元に戻しました")
