#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GmailDistributionButton.tsx の body 置換に priceChangeText を追加（修正版）
"""

button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(button_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleConfirmationConfirm の body 置換に priceChangeText を追加
old_confirm = (
    "      const body = selectedTemplate.body\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);\n"
    "\n"
    "      // バックエンドAPIを使用してメール送信"
)
new_confirm = (
    "      const body = selectedTemplate.body\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)\n"
    "        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());\n"
    "\n"
    "      // バックエンドAPIを使用してメール送信"
)

if old_confirm in text:
    text = text.replace(old_confirm, new_confirm)
    print('✅ handleConfirmationConfirm の body 置換を更新しました')
else:
    print('❌ handleConfirmationConfirm の body が見つかりませんでした')
    # デバッグ用に周辺テキストを表示
    idx = text.find('バックエンドAPIを使用してメール送信')
    if idx >= 0:
        print('--- 周辺テキスト ---')
        print(repr(text[idx-300:idx+50]))

# fallbackToGmailWebUI の body 置換に priceChangeText を追加
old_fallback = (
    "      const body = selectedTemplate.body\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl);\n"
    "\n"
    "      // Gmail Compose URLを生成"
)
new_fallback = (
    "      const body = selectedTemplate.body\n"
    "        .replace(/\\{address\\}/g, propertyData.address)\n"
    "        .replace(/\\{propertyNumber\\}/g, propertyData.propertyNumber)\n"
    "        .replace(/\\{publicUrl\\}/g, propertyData.publicUrl)\n"
    "        .replace(/\\{priceChangeText\\}/g, generatePriceChangeText());\n"
    "\n"
    "      // Gmail Compose URLを生成"
)

if old_fallback in text:
    text = text.replace(old_fallback, new_fallback)
    print('✅ fallbackToGmailWebUI の body 置換を更新しました')
else:
    print('❌ fallbackToGmailWebUI の body が見つかりませんでした')
    idx = text.find('Gmail Compose URLを生成')
    if idx >= 0:
        print('--- 周辺テキスト ---')
        print(repr(text[idx-300:idx+50]))

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
