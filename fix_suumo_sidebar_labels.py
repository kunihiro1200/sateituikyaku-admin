import re

# PropertySidebarStatus.tsx の修正
with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old1 = '\u30ec\u30a4\u30f3\u30ba\u767b\u9332\uff0bSUUMO\u767b\u9332'
new1 = '\u30ec\u30a4\u30f3\u30ba\u767b\u9332\uff0bSUUMO URL \u8981\u767b\u9332'

count = text.count(old1)
print(f'PropertySidebarStatus.tsx: {old1} の出現回数: {count}')
text = text.replace(old1, new1)

with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('PropertySidebarStatus.tsx: Done')

# PropertyListingsPage.tsx の修正（handleRowClick内の古いラベル）
with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content2 = f.read()
text2 = content2.decode('utf-8')

count2 = text2.count(old1)
print(f'PropertyListingsPage.tsx: {old1} の出現回数: {count2}')
text2 = text2.replace(old1, new1)

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))
print('PropertyListingsPage.tsx: Done')
