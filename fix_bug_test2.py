#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
バグ条件探索テストを修正後コードのロジックでテストするよう更新するスクリプト
editableButtonSelectOnClick_buggy → editableButtonSelectOnClick_fixed に変更
"""

file_path = 'frontend/frontend/src/components/__tests__/WorkTaskDetailModal.bug.test.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 全ての editableButtonSelectOnClick_buggy を editableButtonSelectOnClick_fixed に置換
# ただし、関数定義自体は変更しない（関数名の定義行は除く）

# 関数定義行は除外して、呼び出し箇所のみ置換
old_call = '    const result = editableButtonSelectOnClick_buggy(currentValue, clickedOption);'
new_call = '    const result = editableButtonSelectOnClick_fixed(currentValue, clickedOption);'

count = text.count(old_call)
print(f'置換対象の呼び出し箇所: {count}件')

if count > 0:
    text = text.replace(old_call, new_call)
    print(f'✅ {count}件の呼び出しを editableButtonSelectOnClick_fixed に変更しました')
else:
    print('❌ 置換対象が見つかりません')

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ ファイルを保存しました: {file_path}')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8が検出されました')
else:
    print(f'✅ BOMなしUTF-8で保存されています（先頭バイト: {repr(first_bytes)}）')
