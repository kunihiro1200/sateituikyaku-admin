#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerService.updateSeller に landAreaVerified / buildingAreaVerified を追加
"""

print("SellerService.supabase.ts の updateSeller を修正中...")

path = 'backend/src/services/SellerService.supabase.ts'

with open(path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# valuationMethod の後に landAreaVerified / buildingAreaVerified を追加
old_str = '''    if ((data as any).valuationMethod !== undefined) {
      updates.valuation_method = (data as any).valuationMethod;
    }

    // 競合情報フィールド'''

new_str = '''    if ((data as any).valuationMethod !== undefined) {
      updates.valuation_method = (data as any).valuationMethod;
    }
    if ((data as any).landAreaVerified !== undefined) {
      updates.land_area_verified = (data as any).landAreaVerified;
    }
    if ((data as any).buildingAreaVerified !== undefined) {
      updates.building_area_verified = (data as any).buildingAreaVerified;
    }

    // 競合情報フィールド'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print("  ✅ landAreaVerified / buildingAreaVerified を updateSeller に追加しました")
else:
    old_str_crlf = old_str.replace('\n', '\r\n')
    new_str_crlf = new_str.replace('\n', '\r\n')
    if old_str_crlf in text:
        text = text.replace(old_str_crlf, new_str_crlf)
        print("  ✅ (CRLF) landAreaVerified / buildingAreaVerified を updateSeller に追加しました")
    else:
        print("  ❌ 対象箇所が見つかりませんでした")
        idx = text.find('valuationMethod !== undefined')
        if idx >= 0:
            print(repr(text[idx-50:idx+300]))
        raise Exception("Failed")

with open(path, 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ 完了")
