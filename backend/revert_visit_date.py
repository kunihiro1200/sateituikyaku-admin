with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 誤った修正を元に戻す
old = "const visitDate = row['訪問日 \\nY/M/D'];  // スペース+改行文字を含む"
new = "const visitDate = row['訪問日 Y/M/D'];"

count = text.count(old)
print(f'Found {count} occurrences')

text = text.replace(old, new)

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
