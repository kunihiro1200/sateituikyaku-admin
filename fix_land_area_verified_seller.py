#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
土地面積（当社調べ）・建物面積（当社調べ）の修正スクリプト

修正内容:
1. SellerService.supabase.ts の decryptSeller に landAreaVerified / buildingAreaVerified を追加
2. CallModePage.tsx の当社調べフィールドを seller 直接フィールドにも保存できるよう修正
"""

import os

# ============================================================
# Step 1: SellerService.supabase.ts に landAreaVerified を追加
# ============================================================
print("Step 1: SellerService.supabase.ts を修正中...")

seller_service_path = 'backend/src/services/SellerService.supabase.ts'

with open(seller_service_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# seller直接フィールドのマッピングに landAreaVerified / buildingAreaVerified を追加
old_str = '        landArea: seller.land_area,\n        buildingArea: seller.building_area,\n        buildYear: seller.build_year,\n        structure: seller.structure,\n        floorPlan: seller.floor_plan,\n      };\n      \n      return decrypted;'

new_str = '        landArea: seller.land_area,\n        buildingArea: seller.building_area,\n        landAreaVerified: seller.land_area_verified,\n        buildingAreaVerified: seller.building_area_verified,\n        buildYear: seller.build_year,\n        structure: seller.structure,\n        floorPlan: seller.floor_plan,\n      };\n      \n      return decrypted;'

if old_str in text:
    text = text.replace(old_str, new_str)
    print("  ✅ landAreaVerified / buildingAreaVerified を seller 直接フィールドに追加しました")
else:
    # CRLF対応
    old_str_crlf = old_str.replace('\n', '\r\n')
    new_str_crlf = new_str.replace('\n', '\r\n')
    if old_str_crlf in text:
        text = text.replace(old_str_crlf, new_str_crlf)
        print("  ✅ (CRLF) landAreaVerified / buildingAreaVerified を seller 直接フィールドに追加しました")
    else:
        print("  ❌ 対象箇所が見つかりませんでした")
        print("  現在の該当部分を確認:")
        idx = text.find('landArea: seller.land_area')
        if idx >= 0:
            print(repr(text[idx-50:idx+200]))
        raise Exception("Step 1 failed")

with open(seller_service_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print("  ✅ Step 1 完了")

# ============================================================
# Step 2: CallModePage.tsx の当社調べフィールドを修正
# ============================================================
print("\nStep 2: CallModePage.tsx の当社調べフィールドを修正中...")

call_mode_path = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(call_mode_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 土地面積（当社調べ）フィールドの onSave を修正
# property がある場合は property に保存、ない場合は seller に保存
old_land_save = '''                        onSave={async (newValue) => {
                          const parsed = newValue ? parseFloat(newValue) : null;
                          if (property) {
                            await api.put(`/properties/${property.id}`, { landAreaVerified: parsed });
                            setProperty(prev => prev ? { ...prev, landAreaVerified: parsed ?? undefined } : prev);
                          }
                        }}'''

new_land_save = '''                        onSave={async (newValue) => {
                          const parsed = newValue ? parseFloat(newValue) : null;
                          if (property) {
                            await api.put(`/properties/${property.id}`, { landAreaVerified: parsed });
                            setProperty(prev => prev ? { ...prev, landAreaVerified: parsed ?? undefined } : prev);
                          } else if (seller) {
                            await api.put(`/sellers/${seller.id}`, { landAreaVerified: parsed });
                            setSeller(prev => prev ? { ...prev, landAreaVerified: parsed ?? undefined } : prev);
                          }
                        }}'''

if old_land_save in text:
    text = text.replace(old_land_save, new_land_save)
    print("  ✅ 土地面積（当社調べ）の onSave を修正しました")
else:
    old_land_save_crlf = old_land_save.replace('\n', '\r\n')
    new_land_save_crlf = new_land_save.replace('\n', '\r\n')
    if old_land_save_crlf in text:
        text = text.replace(old_land_save_crlf, new_land_save_crlf)
        print("  ✅ (CRLF) 土地面積（当社調べ）の onSave を修正しました")
    else:
        print("  ❌ 土地面積（当社調べ）の対象箇所が見つかりませんでした")
        idx = text.find('landAreaVerified: parsed')
        if idx >= 0:
            print(repr(text[idx-200:idx+200]))
        raise Exception("Step 2a failed")

# 建物面積（当社調べ）フィールドの onSave を修正
old_building_save = '''                        onSave={async (newValue) => {
                          const parsed = newValue ? parseFloat(newValue) : null;
                          if (property) {
                            await api.put(`/properties/${property.id}`, { buildingAreaVerified: parsed });
                            setProperty(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);
                          }
                        }}'''

new_building_save = '''                        onSave={async (newValue) => {
                          const parsed = newValue ? parseFloat(newValue) : null;
                          if (property) {
                            await api.put(`/properties/${property.id}`, { buildingAreaVerified: parsed });
                            setProperty(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);
                          } else if (seller) {
                            await api.put(`/sellers/${seller.id}`, { buildingAreaVerified: parsed });
                            setSeller(prev => prev ? { ...prev, buildingAreaVerified: parsed ?? undefined } : prev);
                          }
                        }}'''

if old_building_save in text:
    text = text.replace(old_building_save, new_building_save)
    print("  ✅ 建物面積（当社調べ）の onSave を修正しました")
else:
    old_building_save_crlf = old_building_save.replace('\n', '\r\n')
    new_building_save_crlf = new_building_save.replace('\n', '\r\n')
    if old_building_save_crlf in text:
        text = text.replace(old_building_save_crlf, new_building_save_crlf)
        print("  ✅ (CRLF) 建物面積（当社調べ）の onSave を修正しました")
    else:
        print("  ❌ 建物面積（当社調べ）の対象箇所が見つかりませんでした")
        idx = text.find('buildingAreaVerified: parsed')
        if idx >= 0:
            print(repr(text[idx-200:idx+200]))
        raise Exception("Step 2b failed")

# 土地面積（当社調べ）の value を seller 直接フィールドにも対応
old_land_value = '''                        value={property?.landAreaVerified?.toString() || ''}'''
new_land_value = '''                        value={property?.landAreaVerified?.toString() || seller?.landAreaVerified?.toString() || ''}'''

if old_land_value in text:
    text = text.replace(old_land_value, new_land_value)
    print("  ✅ 土地面積（当社調べ）の value を修正しました")
else:
    old_land_value_crlf = old_land_value.replace('\n', '\r\n')
    new_land_value_crlf = new_land_value.replace('\n', '\r\n')
    if old_land_value_crlf in text:
        text = text.replace(old_land_value_crlf, new_land_value_crlf)
        print("  ✅ (CRLF) 土地面積（当社調べ）の value を修正しました")
    else:
        print("  ❌ 土地面積（当社調べ）の value が見つかりませんでした")
        raise Exception("Step 2c failed")

# 建物面積（当社調べ）の value を seller 直接フィールドにも対応
old_building_value = '''                        value={property?.buildingAreaVerified?.toString() || ''}'''
new_building_value = '''                        value={property?.buildingAreaVerified?.toString() || seller?.buildingAreaVerified?.toString() || ''}'''

if old_building_value in text:
    text = text.replace(old_building_value, new_building_value)
    print("  ✅ 建物面積（当社調べ）の value を修正しました")
else:
    old_building_value_crlf = old_building_value.replace('\n', '\r\n')
    new_building_value_crlf = new_building_value.replace('\n', '\r\n')
    if old_building_value_crlf in text:
        text = text.replace(old_building_value_crlf, new_building_value_crlf)
        print("  ✅ (CRLF) 建物面積（当社調べ）の value を修正しました")
    else:
        print("  ❌ 建物面積（当社調べ）の value が見つかりませんでした")
        raise Exception("Step 2d failed")

with open(call_mode_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print("  ✅ Step 2 完了")

print("\n✅ 全ての修正が完了しました")
