with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 各EditableSectionを検索
sections = [
    'よく聞かれる項目',
    '内覧情報',
    '基本情報',
    '物件詳細情報',
    '売主・買主情報',
]

for section in sections:
    search = f'title="{section}"'
    idx = text.find(search)
    if idx >= 0:
        snippet = text[idx:idx+400]
        print(f'=== {section} ===')
        print(repr(snippet))
        print()
    else:
        print(f'=== {section} NOT FOUND ===')
        print()
