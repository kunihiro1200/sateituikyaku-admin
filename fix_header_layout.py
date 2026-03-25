import re

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 物件概要セクションの7つのGrid itemを xs={6} sm={4} md={2} → xs={6} sm={4} md="auto" に変更し
# Grid containerに wrap="nowrap" を追加して1段に収める

# Grid container の spacing={0.5} alignItems="flex-start" を
# spacing={0.5} alignItems="flex-start" wrap="nowrap" に変更
old_container = '<Grid container spacing={0.5} alignItems="flex-start">'
new_container = '<Grid container spacing={0.5} alignItems="flex-start" sx={{ flexWrap: \'nowrap\', overflowX: \'auto\' }}>'
text = text.replace(old_container, new_container, 1)

# 7つのGrid item xs={6} sm={4} md={2} を xs="auto" sm="auto" md="auto" に変更
# ただし物件概要セクション内の7つだけ変更する必要があるため、
# Paper内のGrid itemを対象にする

# 所在地・売主氏名・ATBB状況・種別・現況・担当・公開日 の7フィールド
# それぞれ <Grid item xs={6} sm={4} md={2}> → <Grid item xs="auto" sx={{ minWidth: 0, flex: '1 1 0' }}>
# に変更する

# 物件概要セクション内の7つのGrid itemを変更
# 対象: isHeaderEditMode の直前にある7つの <Grid item xs={6} sm={4} md={2}>

# より安全な方法: 物件概要セクション全体を置換
old_grid_item = '<Grid item xs={6} sm={4} md={2}>'
new_grid_item = '<Grid item xs={6} sm={4} md={true} sx={{ minWidth: 120, flex: \'1 1 0\' }}>'

# 物件概要セクション内の7つだけ置換（最初の7回）
count = 0
result = []
i = 0
while i < len(text):
    idx = text.find(old_grid_item, i)
    if idx == -1:
        result.append(text[i:])
        break
    result.append(text[i:idx])
    if count < 7:
        result.append(new_grid_item)
        count += 1
    else:
        result.append(old_grid_item)
    i = idx + len(old_grid_item)

text = ''.join(result)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'Done! Replaced {count} Grid items')
