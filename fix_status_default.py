with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "  const [status, setStatus] = useState('following_up');"
new = "  const [status, setStatus] = useState('追客中');"

if old in text:
    text = text.replace(old, new, 1)
    print('OK')
else:
    print('ERROR: not found')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
