#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
valuations.ts の修正:
1. calculate-valuation-amount1 で seller.property がない場合でも
   seller の直接フィールドを使って PropertyInfo を構築して計算できるようにする
"""

with open('backend/src/routes/valuations.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: calculate-valuation-amount1 の seller.property チェックを修正
old_code = '    // 物件情報を取得\n    if (!seller.property) {\n      return res.status(404).json({\n        error: {\n          code: \'NOT_FOUND\',\n          message: \'Property information not found\',\n          retryable: false,\n        },\n      });\n    }\n\n    // 査定額1を計算\n    console.log(\'🔢 Calculating valuation amount 1 for seller:\', seller.id);\n    console.log(\'📊 Property data:\', seller.property);\n    const { valuationCalculatorService } = await import(\'../services/ValuationCalculatorService\');\n    const valuationAmount1 = await valuationCalculatorService.calculateValuationAmount1(\n      seller,\n      seller.property\n    );\n    console.log(\'💰 Calculated valuation amount 1:\', valuationAmount1);'

new_code = '    // 物件情報を取得（seller.property がない場合は seller の直接フィールドから構築）\n    let propertyInfo = seller.property;\n    if (!propertyInfo) {\n      // seller の直接フィールドから PropertyInfo を構築\n      propertyInfo = {\n        id: \'\',\n        sellerId: seller.id || \'\',\n        address: seller.propertyAddress || \'\',\n        propertyType: seller.propertyType || \'\',\n        landArea: seller.landArea || 0,\n        buildingArea: seller.buildingArea || 0,\n        buildYear: seller.buildYear || 0,\n        structure: seller.structure || \'\',\n        floorPlan: seller.floorPlan || \'\',\n        currentStatus: seller.currentStatus || \'\',\n        sellerSituation: seller.currentStatus || \'\',\n      } as any;\n      console.log(\'⚠️ seller.property is null, using seller direct fields:\', propertyInfo);\n    }\n\n    // 査定額1を計算\n    console.log(\'🔢 Calculating valuation amount 1 for seller:\', seller.id);\n    console.log(\'📊 Property data:\', propertyInfo);\n    const { valuationCalculatorService } = await import(\'../services/ValuationCalculatorService\');\n    const valuationAmount1 = await valuationCalculatorService.calculateValuationAmount1(\n      seller,\n      propertyInfo\n    );\n    console.log(\'💰 Calculated valuation amount 1:\', valuationAmount1);'

if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ calculate-valuation-amount1 の修正完了')
else:
    print('❌ 対象コードが見つかりません')
    # デバッグ用に前後を表示
    idx = text.find('seller.property')
    print(f'seller.property の位置: {idx}')
    print(text[idx-100:idx+200])

with open('backend/src/routes/valuations.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
