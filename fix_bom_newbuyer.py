# BOMを除去してUTF-8（BOMなし）で保存するスクリプト

with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    content = f.read()

# BOMを除去
if content.startswith(b'\xef\xbb\xbf'):
    content = content[3:]
    print('✅ BOMを除去しました')
else:
    print('ℹ️ BOMはありませんでした')

# UTF-8（BOMなし）で書き込む
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'wb') as f:
    f.write(content)

print('✅ ファイルを保存しました')

# 確認
with open('frontend/frontend/src/pages/NewBuyerPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes)} (should start with b"imp" or similar)')
