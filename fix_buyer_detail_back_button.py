with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# navigate(-1) を navigate('/buyers') に変更
old = "onClick={() => navigate(-1)}"
new = "onClick={() => navigate('/buyers')}"

if old in text:
    text = text.replace(old, new)
    print(f'✅ 変更成功: {old} → {new}')
else:
    print('❌ 対象文字列が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
