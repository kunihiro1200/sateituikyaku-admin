#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx のSMSボタン表示条件を修正するスクリプト
変更前: {!buyer.email && buyer.phone_number && (() => {
変更後: {buyer.phone_number && (() => {
コメントも合わせて修正する
"""

file_path = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# コメントの修正
old_comment = '{/* メアドがない場合（または電話番号がある場合）はSMSボタン */}'
new_comment = '{/* 電話番号がある場合はSMSボタン */}'

# 条件式の修正
old_condition = '{!buyer.email && buyer.phone_number && (() => {'
new_condition = '{buyer.phone_number && (() => {'

if old_comment in text:
    text = text.replace(old_comment, new_comment)
    print(f'コメントを修正しました: {old_comment} -> {new_comment}')
else:
    print('コメントが見つかりませんでした（スキップ）')

if old_condition in text:
    text = text.replace(old_condition, new_condition)
    print(f'条件式を修正しました: {old_condition} -> {new_condition}')
else:
    print(f'ERROR: 条件式が見つかりませんでした: {old_condition}')
    exit(1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! ファイルを保存しました。')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (b\'\\xef\\xbb\\xbf\' はBOM付き、それ以外はOK)')
