"""
BuyerViewingResultPage.tsx の handleInlineFieldSave を修正するスクリプト
UTF-8安全な編集を行う

修正内容:
  { sync: isLatestStatus }
  →
  { sync: isLatestStatus, force: isLatestStatus }
"""

target_file = 'frontend/frontend/src/pages/BuyerViewingResultPage.tsx'

with open(target_file, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード
old_code = '        { sync: isLatestStatus }'
# 修正後のコード
new_code = '        { sync: isLatestStatus, force: isLatestStatus }'

if old_code not in text:
    print(f'ERROR: 修正対象のコードが見つかりません。')
    print(f'検索文字列: {repr(old_code)}')
    exit(1)

count = text.count(old_code)
print(f'修正対象のコードが {count} 箇所見つかりました。')

text_fixed = text.replace(old_code, new_code)

# UTF-8（BOMなし）で書き込む
with open(target_file, 'wb') as f:
    f.write(text_fixed.encode('utf-8'))

print(f'修正完了: {target_file}')
print(f'  修正前: {old_code.strip()}')
print(f'  修正後: {new_code.strip()}')

# BOMチェック
with open(target_file, 'rb') as f:
    first_bytes = f.read(3)
if first_bytes == b'\xef\xbb\xbf':
    print('WARNING: BOM付きUTF-8で保存されました')
else:
    print('OK: BOMなしUTF-8で保存されました')
