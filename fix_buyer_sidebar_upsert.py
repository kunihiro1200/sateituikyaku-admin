# -*- coding: utf-8 -*-
"""
買主リストのGASコードでINSERTをUPSERTに変更
"""

with open('gas_buyer_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# INSERT文をUPSERTに変更
# 'Prefer': 'return=representation' を 'Prefer': 'resolution=merge-duplicates' に変更
text = text.replace(
    "'Prefer': 'return=representation'  // エラー詳細を取得するためrepresentationに変更",
    "'Prefer': 'resolution=merge-duplicates'  // UPSERT（ON CONFLICT時は更新）"
)

# UTF-8で書き込む（BOMなし）
with open('gas_buyer_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了: INSERTをUPSERTに変更しました')
