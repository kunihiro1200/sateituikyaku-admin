#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GmailDistributionButton.tsx の body 置換に priceChangeText を追加（CRLF対応版）
"""

button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(button_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF を使った置換
old_confirm = (
    "      const body = selectedTemplate.body\r\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\r\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\r\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);\r\n"
    "\r\n"
    "      // バックエンドAPIを使用してメール送信"
)
new_confirm = (
    "      const body = selectedTemplate.body\r\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\r\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\r\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)\r\n"
    "        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());\r\n"
    "\r\n"
    "      // バックエンドAPIを使用してメール送信"
)

if old_confirm in text:
    text = text.replace(old_confirm, new_confirm)
    print('✅ handleConfirmationConfirm の body 置換を更新しました')
else:
    print('❌ handleConfirmationConfirm の body が見つかりませんでした')

old_fallback = (
    "      const body = selectedTemplate.body\r\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\r\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\r\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);\r\n"
    "\r\n"
    "      // Gmail Compose URLを生成"
)
new_fallback = (
    "      const body = selectedTemplate.body\r\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\r\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\r\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)\r\n"
    "        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());\r\n"
    "\r\n"
    "      // Gmail Compose URLを生成"
)

if old_fallback in text:
    text = text.replace(old_fallback, new_fallback)
    print('✅ fallbackToGmailWebUI の body 置換を更新しました')
else:
    print('❌ fallbackToGmailWebUI の body が見つかりませんでした')

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
