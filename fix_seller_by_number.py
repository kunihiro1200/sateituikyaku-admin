with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のres.json()を修正後に置換
old = '''    res.json({
      id: seller.id,
      sellerNumber: seller.sellerNumber,
      name: seller.name,
      propertyAddress: seller.propertyAddress,
    });'''

new = '''    res.json({
      id: seller.id,
      sellerNumber: seller.sellerNumber,
      name: seller.name,
      propertyAddress: seller.propertyAddress,
      address: seller.address,
      phoneNumber: seller.phoneNumber,
      email: seller.email,
    });'''

if old in text:
    text = text.replace(old, new)
    print('OK: replaced successfully')
else:
    print('ERROR: target string not found')

with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
