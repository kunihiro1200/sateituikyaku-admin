#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の種別「土地」判定条件を修正するスクリプト
propInfo.propertyType の値が 'land', '土', '土地' など複数の形式があるため、
isLandType ヘルパー変数を使って正規化する
"""

import re

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    raw = f.read()

# CRLF -> LF
text = raw.decode('utf-8').replace('\r\n', '\n')

# 1. propInfo の useMemo の直後に isLandType 変数を追加
# propInfo の useMemo ブロックの後に挿入する
# "}, [" で終わる useMemo の後を探す

old_propinfo_end = """  }, [
    property, 
    seller?.propertyAddress,
    seller?.propertyType,
    seller?.landArea,
    seller?.buildingArea,
    seller?.buildYear,
    seller?.floorPlan,
    seller?.structure,
    seller?.currentStatus,
  ]);"""

new_propinfo_end = """  }, [
    property, 
    seller?.propertyAddress,
    seller?.propertyType,
    seller?.landArea,
    seller?.buildingArea,
    seller?.buildYear,
    seller?.floorPlan,
    seller?.structure,
    seller?.currentStatus,
  ]);

  /**
   * 種別が「土地」かどうかを判定するヘルパー
   * スプレッドシートから来る値（'土', '土地'）と英語値（'land'）の両方に対応
   */
  const isLandType = ['land', '土', '土地'].includes(propInfo.propertyType || '');"""

if old_propinfo_end in text:
    text = text.replace(old_propinfo_end, new_propinfo_end)
    print("✅ isLandType 変数を追加しました")
else:
    print("❌ propInfo useMemo の末尾が見つかりませんでした")

# 2. 条件を isLandType に置き換え
# readOnly={propInfo.propertyType === 'land'} → readOnly={isLandType}
old_readonly = "readOnly={propInfo.propertyType === 'land'}"
new_readonly = "readOnly={isLandType}"

if old_readonly in text:
    text = text.replace(old_readonly, new_readonly)
    print("✅ 土地面積の readOnly 条件を修正しました")
else:
    print("❌ readOnly 条件が見つかりませんでした")

# 3. 非表示条件を isLandType に置き換え
# {propInfo.propertyType !== 'land' && ( → {!isLandType && (
old_hide = "{propInfo.propertyType !== 'land' && ("
new_hide = "{!isLandType && ("

count = text.count(old_hide)
if count > 0:
    text = text.replace(old_hide, new_hide)
    print(f"✅ 非表示条件を {count} 箇所修正しました")
else:
    print("❌ 非表示条件が見つかりませんでした")

# LF -> CRLF に戻す
output = text.replace('\n', '\r\n')

with open(filepath, 'wb') as f:
    f.write(output.encode('utf-8'))

print("✅ ファイルを保存しました")
