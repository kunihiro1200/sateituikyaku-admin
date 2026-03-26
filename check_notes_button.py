with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 特記・備忘録の保存ボタンを検索
idx = text.find('handleSaveNotes')
if idx >= 0:
    # 前後を表示
    start = max(0, idx - 200)
    end = min(len(text), idx + 400)
    print(repr(text[start:end]))
else:
    print('handleSaveNotes NOT FOUND')
