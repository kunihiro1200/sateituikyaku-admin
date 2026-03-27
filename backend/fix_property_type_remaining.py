with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
      };
      propertyType = typeMapping[typeStr] || typeStr;
    }
    const landArea = row['土（㎡）'];"""

new = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    }
    const landArea = row['土（㎡）'];"""

count = text.count(old)
print(f'Found {count} occurrences')
text = text.replace(old, new)

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
