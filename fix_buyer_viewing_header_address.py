"""
BuyerViewingResultPage.tsx のヘッダーに物件所在地を追加するスクリプト
- 買主番号 Chip の直後（copiedBuyerNumber の ✓ 表示の後）に追加
- 表示条件: linkedProperties.length > 0 かつ (property_address || address) が非空
- property_address を優先し、存在しない場合は address にフォールバック
"""

file_path = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 挿入対象: copiedBuyerNumber の ✓ 表示の後、前日メールボタンの前
old_str = '''            {copiedBuyerNumber && (
              <Typography variant="body2" sx={{ ml: 1, color: 'success.main', fontWeight: 'bold' }}>✓</Typography>
            )}
          </>
        )}
        {/* 内覧前日Eメールボタン（内覧日前日の場合のみ表示） */}'''

new_str = '''            {copiedBuyerNumber && (
              <Typography variant="body2" sx={{ ml: 1, color: 'success.main', fontWeight: 'bold' }}>✓</Typography>
            )}
          </>
        )}
        {/* 物件所在地（紐づき物件が存在しaddressが非空の場合のみ表示） */}
        {linkedProperties.length > 0 && (linkedProperties[0].property_address || linkedProperties[0].address) && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            {linkedProperties[0].property_address || linkedProperties[0].address}
          </Typography>
        )}
        {/* 内覧前日Eメールボタン（内覧日前日の場合のみ表示） */}'''

if old_str not in text:
    print('ERROR: 対象文字列が見つかりませんでした。')
    print('--- 検索文字列 ---')
    print(repr(old_str[:100]))
else:
    text = text.replace(old_str, new_str, 1)
    with open(file_path, 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done! 物件所在地の表示を追加しました。')
