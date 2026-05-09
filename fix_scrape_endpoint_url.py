filepath = 'frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "      const res = await api.post('/api/tateuri/scrape', { url: propertyUrl.trim() });"
new = "      const res = await api.post('/api/buyers/scrape-property', { url: propertyUrl.trim() });"

if old in text:
    text = text.replace(old, new)
    print('✅ 置換成功')
else:
    print('❌ 対象文字列が見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
