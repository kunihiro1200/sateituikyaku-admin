# updates.confidence → updates.confidence_level に修正
with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# confidence フィールドのマッピングを修正
old = '''    if (data.confidence !== undefined) {
      updates.confidence = data.confidence;
    }'''

new = '''    if (data.confidence !== undefined) {
      updates.confidence_level = data.confidence;
    }'''

count = text.count(old)
print(f'Found {count} occurrences')

if count > 0:
    text = text.replace(old, new)
    with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    # 周辺を確認
    idx = text.find('updates.confidence')
    if idx >= 0:
        print(repr(text[idx-5:idx+60]))
