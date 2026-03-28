#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx の handleRowClick にナビゲーション分岐を追加するスクリプト
file-encoding-protection.md のルールに従い、UTF-8で書き込む
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前の handleRowClick
old_code = """  const handleRowClick = (buyerId: string) => {
    navigate(`/buyers/${buyerId}`);
  };"""

# 変更後の handleRowClick（内覧日前日の場合は /viewing へ遷移）
new_code = """  const handleRowClick = (buyerId: string) => {
    if (selectedCalculatedStatus === '内覧日前日') {
      navigate(`/buyers/${buyerId}/viewing`);
    } else {
      navigate(`/buyers/${buyerId}`);
    }
  };"""

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ handleRowClick の変更に成功しました')
else:
    print('❌ 対象コードが見つかりませんでした')
    import sys
    sys.exit(1)

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルをUTF-8で保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('⚠️  BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')
