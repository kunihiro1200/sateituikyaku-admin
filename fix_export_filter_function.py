#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
filterTemplatesByPropertyType 関数に export を追加するスクリプト
"""

file_path = 'frontend/frontend/src/components/TemplateSelectionModal.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# function filterTemplatesByPropertyType を export function に変更
old = 'function filterTemplatesByPropertyType('
new = 'export function filterTemplatesByPropertyType('

if old in text:
    text = text.replace(old, new)
    print('Export added: SUCCESS')
else:
    print('Export add: FAILED - pattern not found')

# UTF-8で書き込む（BOMなし）
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])}')
