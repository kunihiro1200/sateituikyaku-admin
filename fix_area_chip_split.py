with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: fetchBuyer内の split('、') フォールバックを削除
old1 = "      const initialAreas = areaVal ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、')).map((v: string) => v.trim()).filter(Boolean) : [];"
new1 = "      const initialAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];"

# 修正2: handleInlineFieldSave内の split('、') フォールバックを削除
old2 = "        const updatedAreas = areaVal ? (areaVal.includes('|') ? areaVal.split('|') : areaVal.split('、')).map((v: string) => v.trim()).filter(Boolean) : [];"
new2 = "        const updatedAreas = areaVal ? areaVal.split('|').map((v: string) => v.trim()).filter(Boolean) : [];"

if old1 in text:
    text = text.replace(old1, new1)
    print('修正1: fetchBuyer内のsplit修正完了')
else:
    print('修正1: 対象文字列が見つかりません')

if old2 in text:
    text = text.replace(old2, new2)
    print('修正2: handleInlineFieldSave内のsplit修正完了')
else:
    print('修正2: 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
