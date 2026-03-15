#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の変更:
1. セクションタイトル「問合せ・内覧情報」→「問合せ内容」
2. inquiry_confidence を削除し latest_status（★最新状況）を追加
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: セクションタイトルと inquiry_confidence の削除 + latest_status の追加
old_str = """  {
    title: '問合せ・内覧情報',
    fields: [
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'inquiry_confidence', label: '問合時確度', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },"""

new_str = """  {
    title: '問合せ内容',
    fields: [
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },"""

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ セクションタイトル変更 + inquiry_confidence 削除 + latest_status 追加 完了')
else:
    print('❌ 対象箇所が見つかりませんでした')
    idx = text.find("title: '問合せ・内覧情報'")
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx:idx+500]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
