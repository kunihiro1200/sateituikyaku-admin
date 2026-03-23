with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ナビバーのalignItemsをcenterからflex-endに変更して下端を揃える
old = '''      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>'''

new = '''      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>'''

if old in text:
    text = text.replace(old, new)
    print('alignItems変更成功')
else:
    print('対象文字列が見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
