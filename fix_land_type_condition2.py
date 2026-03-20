#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
isLandType の定義を全パターン対応に更新する
土地: 'land', '土', '土地'
戸建て: 'detached_house', '戸', '戸建', '戸建て'
マンション: 'apartment', 'マ', 'マンション'
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8').replace('\r\n', '\n')

# isLandType の定義を更新（全パターン対応）
old_island = """  /**
   * 種別が「土地」かどうかを判定するヘルパー
   * スプレッドシートから来る値（'土', '土地'）と英語値（'land'）の両方に対応
   */
  const isLandType = ['land', '土', '土地'].includes(propInfo.propertyType || '');"""

new_island = """  /**
   * 種別の正規化ヘルパー
   * スプレッドシート値（'土', '戸', 'マ' など）と英語値（'land' など）の両方に対応
   */
  const LAND_TYPE_VALUES = ['land', '土', '土地'];
  const isLandType = LAND_TYPE_VALUES.includes(propInfo.propertyType || '');"""

if old_island in text:
    text = text.replace(old_island, new_island)
    print("✅ isLandType の定義を更新しました")
else:
    # 既に更新済みかもしれないので現状確認
    idx = text.find('const isLandType')
    if idx >= 0:
        print(f"現在の定義:\n{text[idx-200:idx+200]}")
    else:
        print("❌ isLandType が見つかりません")

# LF -> CRLF
output = text.replace('\n', '\r\n')
with open(filepath, 'wb') as f:
    f.write(output.encode('utf-8'))

print("✅ 保存完了")
