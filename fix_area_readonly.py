with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

# CRLF -> LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 土地面積 (m²): readOnly={isLandType} → readOnly={isLandType || !!(property?.landArea || seller?.landArea)}
old1 = (
    '                      <InlineEditableField\n'
    '                        label="土地面積 (m²)"\n'
    '                        value={(property?.landArea || seller?.landArea)?.toString() || \'\'}\n'
    '                        fieldName="landArea"\n'
    '                        fieldType="text"\n'
    '                        readOnly={isLandType}'
)
new1 = (
    '                      <InlineEditableField\n'
    '                        label="土地面積 (m²)"\n'
    '                        value={(property?.landArea || seller?.landArea)?.toString() || \'\'}\n'
    '                        fieldName="landArea"\n'
    '                        fieldType="text"\n'
    '                        readOnly={isLandType || !!(property?.landArea || seller?.landArea)}'
)

# 建物面積 (m²): readOnly なし → readOnly={!!(property?.buildingArea || seller?.buildingArea)} を追加
old2 = (
    '                      <InlineEditableField\n'
    '                        label="建物面積 (m²)"\n'
    '                        value={(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}\n'
    '                        fieldName="buildingArea"\n'
    '                        fieldType="text"\n'
    '                        onSave={async (newValue) => {'
)
new2 = (
    '                      <InlineEditableField\n'
    '                        label="建物面積 (m²)"\n'
    '                        value={(property?.buildingArea || seller?.buildingArea)?.toString() || \'\'}\n'
    '                        fieldName="buildingArea"\n'
    '                        fieldType="text"\n'
    '                        readOnly={!!(property?.buildingArea || seller?.buildingArea)}\n'
    '                        onSave={async (newValue) => {'
)

if old1 in text:
    text = text.replace(old1, new1)
    print('✅ 土地面積 readOnly 修正完了')
else:
    print('❌ 土地面積の対象箇所が見つかりません')

if old2 in text:
    text = text.replace(old2, new2)
    print('✅ 建物面積 readOnly 追加完了')
else:
    print('❌ 建物面積の対象箇所が見つかりません')

# CRLF に戻して書き込む
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.replace('\n', '\r\n').encode('utf-8'))

print('完了')
