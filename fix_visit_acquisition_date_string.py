#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visitAcquisitionDateを文字列のまま表示するよう修正
バックエンドが文字列（YYYY-MM-DD）で返すようになったので、
new Date() 変換不要。文字列を直接表示する。
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_display = """                              {seller?.visitAcquisitionDate ? (
                                new Date(seller.visitAcquisitionDate + 'T00:00:00+09:00').toLocaleDateString('ja-JP', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit'
                                })
                              ) : '未設定'}"""

new_display = """                              {seller?.visitAcquisitionDate ? (
                                String(seller.visitAcquisitionDate).slice(0, 10)
                              ) : '未設定'}"""

if old_display in text:
    text = text.replace(old_display, new_display, 1)
    print('✅ 表示側を文字列直接表示に修正しました')
else:
    print('❌ 対象コードが見つかりません')

# また、既存値チェックも文字列比較に対応させる
# seller?.visitAcquisitionDate は Date オブジェクトではなく文字列になった
# 既存の条件チェックはそのままでOK（文字列の truthy チェック）

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
