with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

# 修正1: !property チェックを !propInfo に変更
old = "    if (!seller || !property) {\n      setError('売主情報または物件情報が取得できません。');\n      return;\n    }\n\n    // 査定額を万円単位に変換\n    const amount1Man = Math.round(parseInt(editedValuationAmount1) / 10000);\n    const amount2Man = Math.round(parseInt(editedValuationAmount2) / 10000);\n    const amount3Man = Math.round(parseInt(editedValuationAmount3) / 10000);\n\n    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先）\n    const landArea = property.landAreaVerified || property.landArea || '未設定';\n    const buildingArea = property.buildingAreaVerified || property.buildingArea || '未設定';"

new = "    if (!seller) {\n      setError('売主情報または物件情報が取得できません。');\n      return;\n    }\n\n    // 査定額を万円単位に変換\n    const amount1Man = Math.round(parseInt(editedValuationAmount1) / 10000);\n    const amount2Man = Math.round(parseInt(editedValuationAmount2) / 10000);\n    const amount3Man = Math.round(parseInt(editedValuationAmount3) / 10000);\n\n    // 土地面積と建物面積を取得（「当社調べ」フィールドを優先、propInfoを使用）\n    const landArea = propInfo.landAreaVerified || propInfo.landArea || '未設定';\n    const buildingArea = propInfo.buildingAreaVerified || propInfo.buildingArea || '未設定';"

if old in content:
    content = content.replace(old, new)
    print('修正成功')
else:
    print('対象文字列が見つかりません')
    # デバッグ用に周辺を表示
    idx = content.find('土地面積と建物面積を取得')
    if idx >= 0:
        print('周辺コード:')
        print(repr(content[idx-200:idx+300]))

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))
