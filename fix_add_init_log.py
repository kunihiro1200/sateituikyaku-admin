with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """      setEditedLandAreaVerified((propertyData?.landAreaVerified || sellerData.landAreaVerified)?.toString() || '');"""

new = """      const _landAreaVerified = (propertyData?.landAreaVerified || sellerData.landAreaVerified)?.toString() || '';
      console.log('🔧 [初期化] landAreaVerified:', _landAreaVerified, 'propertyData?.landAreaVerified:', propertyData?.landAreaVerified, 'sellerData.landAreaVerified:', sellerData.landAreaVerified);
      setEditedLandAreaVerified(_landAreaVerified);"""

if old in text:
    text = text.replace(old, new)
    print('✅ 初期化ログ追加成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
