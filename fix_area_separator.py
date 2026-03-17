# split を | と 、 両方に対応（後方互換性）
with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 後方互換: | で split、なければ 、 で split
old1 = "const initialAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];"
new1 = "const initialAreas = areaVal ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、')).map((v: string) => v.trim()).filter(Boolean) : [];"
text = text.replace(old1, new1)

old2 = "const updatedAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];"
new2 = "const updatedAreas = areaVal ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、')).map((v: string) => v.trim()).filter(Boolean) : [];"
text = text.replace(old2, new2)

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
