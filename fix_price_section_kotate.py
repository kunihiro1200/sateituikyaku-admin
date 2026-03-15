with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "const showMonthlyPayment = propertyType === '戸建て' || propertyType === 'マンション' || propertyType === '戸' || propertyType === 'マ';"
new = "const showMonthlyPayment = propertyType === '戸建て' || propertyType === 'マンション' || propertyType === '戸' || propertyType === 'マ' || propertyType === '戸建';"

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('OK: showMonthlyPayment に 戸建 を追加しました')
else:
    print('ERROR: 対象文字列が見つかりません')
    print('現在の該当行:')
    for line in text.split('\n'):
        if 'showMonthlyPayment' in line and 'const' in line:
            print(repr(line))
