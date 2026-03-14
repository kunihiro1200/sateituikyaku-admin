with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# propertyAddress の後に propertyNumber を追加
old = "        propertyAddress: property?.address || '',\n        propertyGoogleMapUrl: property?.google_map_url || '',"
new = "        propertyAddress: property?.address || '',\n        propertyNumber: property?.property_number || '',\n        propertyGoogleMapUrl: property?.google_map_url || '',"

if old in text:
    text = text.replace(old, new)
    print('✅ propertyNumber を追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用に周辺を表示
    idx = text.find('propertyAddress: property?.address')
    if idx >= 0:
        print('周辺テキスト:', repr(text[idx-50:idx+200]))

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
