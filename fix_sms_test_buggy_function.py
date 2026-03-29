#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmsPreViewingNoPhoneBug.property.test.ts の shouldShowSmsButton_buggy を
修正済み条件に更新するスクリプト

修正後のBuyerViewingResultPage.tsxの条件は buyer.phone_number のみ。
テストの shouldShowSmsButton_buggy を修正済み条件に合わせて更新する。
"""

file_path = 'frontend/frontend/src/__tests__/SmsPreViewingNoPhoneBug.property.test.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# shouldShowSmsButton_buggy の実装を修正済み条件に更新
# 単純な文字列置換（改行コードに依存しない）
old_condition = '  return !buyer.email && !!buyer.phone_number;'
new_condition = '  return !!buyer.phone_number;'

old_comment = ' * 現在の（バグのある）SMSボタン表示条件\r\n * BuyerViewingResultPage.tsx の実際の条件: !buyer.email && buyer.phone_number'
new_comment = ' * 修正済みのSMSボタン表示条件\r\n * BuyerViewingResultPage.tsx の修正後の条件: buyer.phone_number'

if old_condition in text:
    text = text.replace(old_condition, new_condition)
    print(f'条件式を更新しました: {old_condition} -> {new_condition}')
else:
    print('ERROR: 条件式が見つかりませんでした')
    exit(1)

if old_comment in text:
    text = text.replace(old_comment, new_comment)
    print('コメントを更新しました')
else:
    print('コメントが見つかりませんでした（スキップ）')

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])}')
