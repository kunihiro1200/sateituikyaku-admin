#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の SMS 本文生成で使用する address の取得順序を修正する
変更前: display_address || property_address || address
変更後: address || display_address || property_address
理由: display_address に不正な値（建物名のみなど）が入っている場合があるため
"""

file_path = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "const address = property?.display_address || property?.property_address || property?.address || buyer.other_company_property || '';"
new = "const address = property?.address || property?.display_address || property?.property_address || buyer.other_company_property || '';"

if old in text:
    text = text.replace(old, new)
    print('変更適用完了: SMS address 取得順序を address 優先に変更')
else:
    print('スキップ: 対象文字列が見つかりません')
    print('検索対象:', repr(old[:80]))

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: ファイルを UTF-8 で保存しました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM チェック: {repr(first_bytes[:3])}')
