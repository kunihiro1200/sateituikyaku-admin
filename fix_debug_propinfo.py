with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先、propInfoを使用）
    const landArea = propInfo.landAreaVerified || propInfo.landArea || '未設定';
    const buildingArea = propInfo.buildingAreaVerified || propInfo.buildingArea || '未設定';"""

new = """    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先、propInfoを使用）
    console.log('🏠 [メール生成] propInfo:', JSON.stringify({
      landArea: propInfo.landArea,
      buildingArea: propInfo.buildingArea,
      landAreaVerified: propInfo.landAreaVerified,
      buildingAreaVerified: propInfo.buildingAreaVerified,
    }));
    console.log('🏠 [メール生成] seller.landAreaVerified:', seller?.landAreaVerified);
    console.log('🏠 [メール生成] seller.buildingAreaVerified:', seller?.buildingAreaVerified);
    const landArea = propInfo.landAreaVerified || propInfo.landArea || '未設定';
    const buildingArea = propInfo.buildingAreaVerified || propInfo.buildingArea || '未設定';
    console.log('🏠 [メール生成] 使用する面積値 landArea:', landArea, 'buildingArea:', buildingArea);"""

if old in text:
    text = text.replace(old, new)
    print('✅ デバッグログ追加成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
