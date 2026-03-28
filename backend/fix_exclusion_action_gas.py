#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gas_complete_code.js に除外日にすること の同期処理を追加
"""

with open('../gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF を LF に正規化して検索
text_lf = text.replace('\r\n', '\n')

old_block = "    var sheetFirstCallPerson = row['一番TEL'] ? String(row['一番TEL']) : null;\n    var dbFirstCallPerson = dbSeller.first_call_person || null;\n    if (sheetFirstCallPerson !== dbFirstCallPerson) {\n      updateData.first_call_person = sheetFirstCallPerson;\n      needsUpdate = true;\n    }"

new_block = old_block + "\n\n    var sheetExclusionAction = row['除外日にすること'] ? String(row['除外日にすること']) : null;\n    var dbExclusionAction = dbSeller.exclusion_action || null;\n    if (sheetExclusionAction !== dbExclusionAction) {\n      updateData.exclusion_action = sheetExclusionAction;\n      needsUpdate = true;\n    }"

if old_block in text_lf:
    text_lf = text_lf.replace(old_block, new_block)
    print("✅ gas_complete_code.js に除外日にすること の同期処理を追加しました")
else:
    print("❌ 対象ブロックが見つかりません")
    idx = text_lf.find("sheetFirstCallPerson")
    if idx >= 0:
        print("周辺テキスト:")
        print(repr(text_lf[idx:idx+400]))

# LF のまま保存（UTF-8）
with open('../gas_complete_code.js', 'wb') as f:
    f.write(text_lf.encode('utf-8'))
