#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
handleSendPriceReductionChat に selectedImageUrl を組み込む
"""

with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# メッセージに画像URLを追加
old_message = """      const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\\n` : '';
      const message = {
        text: `${propertyNumberLine}【値下げ通知】\\n${latestReduction}\\n${address || ''}\\n${propertyUrl}`
      };"""
new_message = """      const propertyNumberLine = propertyNumber ? `物件番号：${propertyNumber}\\n` : '';
      const imageUrlLine = selectedImageUrl ? `\\n📷 ${selectedImageUrl}` : '';
      const message = {
        text: `${propertyNumberLine}【値下げ通知】\\n${latestReduction}\\n${address || ''}\\n${propertyUrl}${imageUrlLine}`
      };"""
text = text.replace(old_message, new_message, 1)

# 送信成功後にselectedImageUrlをリセット
old_success = "      onChatSendSuccess('値下げ通知を送信しました');"
new_success = "      onChatSendSuccess('値下げ通知を送信しました');\n      setSelectedImageUrl(undefined);"
text = text.replace(old_success, new_success, 1)

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! 画像URL送信処理を追加しました')
