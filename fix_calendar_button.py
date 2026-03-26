with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 条件付き表示を常時表示に変更
old = "              {visitDate && visitAssignee && ("
new = "              {true && ("

if old in text:
    text = text.replace(old, new, 1)
    print('OK')
else:
    print('ERROR: not found')

with open('frontend/frontend/src/pages/NewSellerPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
