#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EditableButtonSelect のトグルロジック修正スクリプト
UTF-8エンコーディングを保護しながら安全に編集する
"""

file_path = 'frontend/frontend/src/components/WorkTaskDetailModal.tsx'

# ファイルをバイナリで読み込む（エンコーディング保護）
with open(file_path, 'rb') as f:
    content = f.read()

# UTF-8でデコード
text = content.decode('utf-8')

# 修正前のコード（バグあり: トグルロジックなし）
old_code = 'onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}'

# 修正後のコード（EditableYesNoと同じトグルパターンを適用）
new_code = 'onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === opt ? null : opt); }}'

# 変更前に存在確認
if old_code in text:
    print(f'✅ 修正対象を発見しました')
    text = text.replace(old_code, new_code)
    print(f'✅ トグルロジックを適用しました')
else:
    print(f'❌ 修正対象が見つかりません。既に修正済みか、コードが変更されている可能性があります。')
    # 現在の状態を確認
    if new_code in text:
        print(f'✅ 既に修正済みです')
    exit(1)

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
