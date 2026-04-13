with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# propInfo.landAreaVerified の代わりに editedLandAreaVerified を使う
old = """    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先、propInfoを使用）
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

new = """    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先）
    // editedLandAreaVerified は画面表示値（propertyData || sellerData のフォールバック済み）
    const landArea = editedLandAreaVerified || editedLandArea || propInfo.landArea || '未設定';
    const buildingArea = editedBuildingAreaVerified || editedBuildingArea || propInfo.buildingArea || '未設定';"""

if old in text:
    text = text.replace(old, new)
    print('✅ 修正成功')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ: 前後の文字列を確認
    idx = text.find('editedLandAreaVerified || editedLandArea')
    if idx >= 0:
        print('既に修正済みの可能性あり')
    idx2 = text.find('propInfo.landAreaVerified || propInfo.landArea')
    if idx2 >= 0:
        print(f'元の文字列が見つかった位置: {idx2}')
        print(repr(text[idx2-200:idx2+200]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
