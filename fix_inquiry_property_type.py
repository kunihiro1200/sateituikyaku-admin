with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# inquiry_property_typeのマッピングをproperty_typeからdesired_property_typeに変更
old = '      inquiry_property_type: buyer.property_type ?? null,'
new = '      inquiry_property_type: buyer.desired_property_type ?? null,'

if old in text:
    text = text.replace(old, new)
    print('✅ inquiry_property_type を property_type → desired_property_type に変更しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # 周辺を確認
    idx = text.find('inquiry_property_type')
    if idx >= 0:
        print(f'  現在の記述: {repr(text[idx:idx+60])}')

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
