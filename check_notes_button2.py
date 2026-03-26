with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 保存ボタンのsxプロパティを検索
idx = text.find('onClick={handleSaveNotes}')
if idx >= 0:
    start = max(0, idx - 100)
    end = min(len(text), idx + 300)
    print(repr(text[start:end]))
else:
    print('onClick={handleSaveNotes} NOT FOUND')
