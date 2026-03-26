#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bug 2 修正: 物件概要バーの Paper コンポーネントに position: sticky を追加
"""

file_path = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前の文字列
old_str = "<Paper sx={{ p: 1, mb: 2, bgcolor: '#f5f5f5' }}>"

# 修正後の文字列
new_str = "<Paper sx={{ p: 1, mb: 2, bgcolor: '#f5f5f5', position: 'sticky', top: 48, zIndex: 100 }}>"

if old_str in text:
    text = text.replace(old_str, new_str, 1)
    print(f'✅ 修正成功: position: sticky を追加しました')
else:
    print(f'❌ 対象文字列が見つかりませんでした')
    print('現在のファイル内容を確認してください')
    import sys
    sys.exit(1)

# UTF-8で書き込む（BOMなし）
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️ BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')
