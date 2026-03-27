with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# updateSingleSeller と syncSingleSeller の typeMapping を修正
# '戸': '戸建' → '戸': '戸建て'
old = "'土': '土地', '戸': '戸建', 'マ': 'マンション', '事': '事業用',"
new = "'土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',"

count = text.count(old)
print(f'Found {count} occurrences')

text = text.replace(old, new)

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
