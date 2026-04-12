with open('frontend/frontend/src/components/WorkTaskSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# formatValue関数の日付判定条件を修正
old = "    if (key.includes('date') || key.includes('deadline')) {"
new = "    if (key.includes('date') || key.includes('deadline') || key.includes('completed')) {"

if old not in text:
    print('ERROR: 対象文字列が見つかりません')
    exit(1)

text = text.replace(old, new, 1)

with open('frontend/frontend/src/components/WorkTaskSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! WorkTaskSection.tsx を修正しました')
