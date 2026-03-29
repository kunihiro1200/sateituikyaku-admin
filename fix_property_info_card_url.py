with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 壊れたURLを修正（テンプレートリテラルが壊れている）
old = "      const response = await api.get(/api/property-listings//buyers);"
new = "      const response = await api.get(`/api/property-listings/${propertyId}/buyers`);"

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done - URL fixed')
else:
    # 別のパターンを探す
    import re
    matches = re.findall(r'api\.get\([^)]+buyers[^)]*\)', text)
    print('Found patterns:', matches)
