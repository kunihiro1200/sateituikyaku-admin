with open('src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# updateSingleSeller と syncSingleSeller の typeMapping フォールバックを修正
# typeMapping[typeStr] || typeStr → 正規化マッピングを追加
# 許容値: '土地', '戸建て', 'マンション', '事業用', 'その他'

old1 = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
      };
      propertyType = typeMapping[typeStr] || typeStr;
    }

    await this.propertySyncHandler.syncProperty"""

new1 = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    }

    await this.propertySyncHandler.syncProperty"""

count1 = text.count(old1)
print(f'Pattern 1: Found {count1} occurrences')
text = text.replace(old1, new1)

# syncSingleSeller の同じパターン（PropertySyncHandlerへの呼び出し前）
old2 = """        const typeMapping: Record<string, string> = {
          '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        };
        propertyType = typeMapping[typeStr] || typeStr;"""

new2 = """        const typeMapping: Record<string, string> = {
          '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
          '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
        };
        propertyType = typeMapping[typeStr] || 'その他';"""

count2 = text.count(old2)
print(f'Pattern 2: Found {count2} occurrences')
text = text.replace(old2, new2)

# 3つ目のパターン（syncSingleSeller内のPropertySyncHandler呼び出し前）
old3 = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
      };
      propertyType = typeMapping[typeStr] || typeStr;
    }

    const landArea"""

new3 = """      const typeMapping: Record<string, string> = {
        '土': '土地', '戸': '戸建て', 'マ': 'マンション', '事': '事業用',
        '土地': '土地', '戸建': '戸建て', '戸建て': '戸建て', 'マンション': 'マンション', '事業用': '事業用',
      };
      propertyType = typeMapping[typeStr] || 'その他';
    }

    const landArea"""

count3 = text.count(old3)
print(f'Pattern 3: Found {count3} occurrences')
text = text.replace(old3, new3)

with open('src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
