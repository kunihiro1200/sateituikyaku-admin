# EnhancedAutoSyncService.tsの「1番電話」を「一番TEL」に変更
with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

count = text.count('1番電話')
print(f'「1番電話」の出現回数: {count}')

text = text.replace('1番電話', '一番TEL')

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 完了')
