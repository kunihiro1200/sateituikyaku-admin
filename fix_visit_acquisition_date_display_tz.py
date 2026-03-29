#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
訪問取得日の表示でタイムゾーンずれを修正
new Date('YYYY-MM-DD') はUTC午前0時として解釈されるため、
日本時間で表示すると前日になる問題を修正
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 表示側: new Date(seller.visitAcquisitionDate).toLocaleDateString で timeZone を追加
old_display = """                                new Date(seller.visitAcquisitionDate).toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'"""

new_display = """                                new Date(seller.visitAcquisitionDate + 'T00:00:00+09:00').toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'"""

if old_display in text:
    text = text.replace(old_display, new_display, 1)
    print('✅ 表示側のタイムゾーン修正を適用しました')
else:
    print('❌ 表示側のコードが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
