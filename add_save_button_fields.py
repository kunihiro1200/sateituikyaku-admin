#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx に SAVE_BUTTON_FIELDS 定数を追加するスクリプト
"""

file_path = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入するコード
save_button_fields_const = """// 保存ボタン押下時にまとめて保存するフィールドのセット
const SAVE_BUTTON_FIELDS = new Set([
  'inquiry_email_phone',
  'distribution_type',
  'pinrich',
  'broker_survey',
  'three_calls_confirmed',
  'initial_assignee',
  'owned_home_hearing_inquiry',
  'owned_home_hearing_result',
  'valuation_required',
  'broker_inquiry',
]);

"""

# BUYER_FIELD_SECTIONS の直前に挿入
target = 'const BUYER_FIELD_SECTIONS = ['
if target not in text:
    print('ERROR: target string not found')
    exit(1)

if 'SAVE_BUTTON_FIELDS' in text:
    print('SKIP: SAVE_BUTTON_FIELDS already exists')
    exit(0)

text = text.replace(target, save_button_fields_const + target, 1)

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! SAVE_BUTTON_FIELDS added successfully.')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('WARNING: BOM detected!')
else:
    print('OK: No BOM (UTF-8 without BOM)')
