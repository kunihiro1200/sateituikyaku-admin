#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NewBuyerPage.tsx に売主コピー・買主コピーの state を追加するスクリプト
"""

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# チャット送信状態の前に売主コピー・買主コピーの state を追加
old_str = '  // チャット送信状態\n  const [chatSending, setChatSending] = useState(false);'

new_str = '''  // 売主コピー
  const [sellerCopyInput, setSellerCopyInput] = useState('');
  const [sellerCopyOptions, setSellerCopyOptions] = useState<Array<{sellerNumber: string; name: string; id: string}>>([]);
  const [sellerCopyLoading, setSellerCopyLoading] = useState(false);

  // 買主コピー
  const [buyerCopyInput, setBuyerCopyInput] = useState('');
  const [buyerCopyOptions, setBuyerCopyOptions] = useState<Array<{buyer_number: string; name: string}>>([]);
  const [buyerCopyLoading, setBuyerCopyLoading] = useState(false);

  // チャット送信状態
  const [chatSending, setChatSending] = useState(false);'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ state を追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    import sys
    sys.exit(1)

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (BOMなしであればOK)')
