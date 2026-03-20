#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
propInfo の propertyType を正規化する関数を追加し、
isLandType の定義をシンプルにする。

正規化マッピング:
  '土', '土地', 'land'  → 'land'
  '戸', '戸建', '戸建て', 'detached_house' → 'detached_house'
  'マ', 'マンション', 'apartment' → 'apartment'
  '商業用', 'commercial' → 'commercial'
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8').replace('\r\n', '\n')

# 1. getPropertyTypeLabel 関数の直後に normalizePropertyType 関数を追加
old_get_label_end = """    return labels[type] || type;
  };

  // 状況（売主）を日本語に変換（current_statusフィールド用）"""

new_get_label_end = """    return labels[type] || type;
  };

  /**
   * 物件種別を正規化する関数
   * スプレッドシート値（'土', '戸', 'マ' など）を英語値に統一する
   */
  const normalizePropertyType = (type: string | undefined): string | undefined => {
    if (!type) return undefined;
    const map: Record<string, string> = {
      // 土地
      '土': 'land',
      '土地': 'land',
      'land': 'land',
      // 戸建て
      '戸': 'detached_house',
      '戸建': 'detached_house',
      '戸建て': 'detached_house',
      'detached_house': 'detached_house',
      // マンション
      'マ': 'apartment',
      'マンション': 'apartment',
      'apartment': 'apartment',
      // 商業用
      '商業用': 'commercial',
      'commercial': 'commercial',
    };
    return map[type] ?? type;
  };

  // 状況（売主）を日本語に変換（current_statusフィールド用）"""

if old_get_label_end in text:
    text = text.replace(old_get_label_end, new_get_label_end)
    print("✅ normalizePropertyType 関数を追加しました")
else:
    print("❌ 挿入箇所が見つかりませんでした")

# 2. propInfo の useMemo 内で propertyType を正規化する
# property がある場合
old_prop_type = "        propertyType: property.propertyType,"
new_prop_type = "        propertyType: normalizePropertyType(property.propertyType),"

if old_prop_type in text:
    text = text.replace(old_prop_type, new_prop_type)
    print("✅ property.propertyType を正規化しました")
else:
    print("❌ property.propertyType の箇所が見つかりませんでした")

# seller がある場合
old_seller_type = "        propertyType: seller.propertyType,"
new_seller_type = "        propertyType: normalizePropertyType(seller.propertyType),"

if old_seller_type in text:
    text = text.replace(old_seller_type, new_seller_type)
    print("✅ seller.propertyType を正規化しました")
else:
    print("❌ seller.propertyType の箇所が見つかりませんでした")

# 3. isLandType をシンプルに（LAND_TYPE_VALUES は不要になる）
old_island = """  /**
   * 種別の正規化ヘルパー
   * スプレッドシート値（'土', '戸', 'マ' など）と英語値（'land' など）の両方に対応
   */
  const LAND_TYPE_VALUES = ['land', '土', '土地'];
  const isLandType = LAND_TYPE_VALUES.includes(propInfo.propertyType || '');"""

new_island = """  // 種別が「土地」かどうか（propInfo.propertyType は正規化済みなので 'land' のみ比較）
  const isLandType = propInfo.propertyType === 'land';"""

if old_island in text:
    text = text.replace(old_island, new_island)
    print("✅ isLandType をシンプルに更新しました")
else:
    print("❌ isLandType の定義が見つかりませんでした")

# LF -> CRLF
output = text.replace('\n', '\r\n')
with open(filepath, 'wb') as f:
    f.write(output.encode('utf-8'))

print("✅ ファイルを保存しました")
