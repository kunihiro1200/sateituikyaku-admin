with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """    // 土地・建物面積
    result = result.replace(/<<土（㎡）>>/g, property.landArea?.toString() || '');
    result = result.replace(/<<建（㎡）>>/g, property.buildingArea?.toString() || '');"""

new = """    // 土地・建物面積（「当社調べ」があれば優先）
    const _landAreaForTemplate = editedLandAreaVerified || editedLandArea || property.landArea?.toString() || '';
    const _buildingAreaForTemplate = editedBuildingAreaVerified || editedBuildingArea || property.buildingArea?.toString() || '';
    result = result.replace(/<<土（㎡）>>/g, _landAreaForTemplate);
    result = result.replace(/<<建（㎡）>>/g, _buildingAreaForTemplate);"""

if old in text:
    text = text.replace(old, new)
    print('✅ テンプレートプレースホルダー修正成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
