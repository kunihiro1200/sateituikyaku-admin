import re

with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# '1番電話' → '一番TEL' に戻す
text = text.replace("row['1番電話']", "row['一番TEL']")
text = text.replace('sheetRow[\'1番電話\']', "sheetRow['一番TEL']")

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! 3箇所を一番TELに戻しました')
