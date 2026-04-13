import re

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# property が存在する場合の landAreaVerified/buildingAreaVerified を
# seller の値をフォールバックとして使うよう修正
old = """    if (property) {
      return {
        address: property.address,
        propertyType: normalizePropertyType(property.propertyType),
        landArea: property.landArea,
        buildingArea: property.buildingArea,
        landAreaVerified: property.landAreaVerified,
        buildingAreaVerified: property.buildingAreaVerified,
        buildYear: property.buildYear,
        floorPlan: property.floorPlan,
        structure: property.structure,
        currentStatus: property.currentStatus || property.sellerSituation,
      };
    }"""

new = """    if (property) {
      return {
        address: property.address,
        propertyType: normalizePropertyType(property.propertyType),
        landArea: property.landArea,
        buildingArea: property.buildingArea,
        // propertiesテーブルにない場合はsellersテーブルの値をフォールバック
        landAreaVerified: property.landAreaVerified ?? seller?.landAreaVerified,
        buildingAreaVerified: property.buildingAreaVerified ?? seller?.buildingAreaVerified,
        buildYear: property.buildYear,
        floorPlan: property.floorPlan,
        structure: property.structure,
        currentStatus: property.currentStatus || property.sellerSituation,
      };
    }"""

if old in text:
    text = text.replace(old, new)
    print('✅ 修正成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
