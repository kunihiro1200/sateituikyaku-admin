with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

checks = [
    ('よく聞かれる項目 hasChanges', 'handleCancelFrequentlyAsked}\n                hasChanges={Object.keys(editedData).length > 0}'),
    ('内覧情報 hasChanges', 'handleCancelViewingInfo}\n                hasChanges={Object.keys(editedData).length > 0}'),
    ('基本情報 hasChanges', 'handleCancelBasicInfo}\n                hasChanges={Object.keys(editedData).length > 0}'),
    ('物件詳細情報 hasChanges', 'handleCancelPropertyDetails}\n                hasChanges={Object.keys(editedData).length > 0}'),
    ('売主・買主情報 hasChanges', 'handleCancelSellerBuyer}\n                hasChanges={Object.keys(editedData).length > 0}'),
    ('特記・備忘録 pulseSave', "animation: 'pulseSave 1.5s infinite'"),
]

for name, pattern in checks:
    if pattern in text:
        print(f'✅ {name}: OK')
    else:
        print(f'❌ {name}: NOT FOUND')
