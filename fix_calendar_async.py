# fix_calendar_async.py
# handleCalendarButtonClick を async 関数に変更する

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# const handleCalendarButtonClick = () => を async に変更
old = "  const handleCalendarButtonClick = () => {"
new = "  const handleCalendarButtonClick = async () => {"

if old in text:
    text = text.replace(old, new)
    print('✅ handleCalendarButtonClick を async に変更しました')
else:
    print('❌ 対象箇所が見つかりませんでした')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ UTF-8（BOMなし）で保存しました')
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    print('BOM check:', repr(f.read(3)))
