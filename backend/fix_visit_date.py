import re

with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 2箇所の visitDate = row['訪問日 Y/M/D'] を修正
# updateSingleSeller と syncSingleSeller の両方
old = "const visitDate = row['訪問日 Y/M/D'];"
new = "const visitDate = row['訪問日 \\nY/M/D'];  // スペース+改行文字を含む"

count = text.count(old)
print(f"Found {count} occurrences of the pattern")

text = text.replace(old, new)

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
