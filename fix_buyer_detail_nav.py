with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 検索バーの幅を240px → 360pxに変更（1.5倍）
text = text.replace('sx={{ width: 240 }}', 'sx={{ width: 360 }}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Width changed from 240 to 360')
