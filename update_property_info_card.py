
# PropertyInfoCard.tsx を UTF-8 で更新するスクリプト
with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
print('File read successfully, length:', len(text))
print('First 100 chars:', repr(text[:100]))
