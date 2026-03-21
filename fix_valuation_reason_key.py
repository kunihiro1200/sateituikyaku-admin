"""
EnhancedAutoSyncService.tsの査定理由キーを修正
'査定理由' → '査定理由（査定サイトから転記）'
"""

with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前後の確認
old_str = "const valuationReason = row['査定理由'];"
new_str = "const valuationReason = row['査定理由（査定サイトから転記）'];"

count = text.count(old_str)
print(f"修正対象の件数: {count}")

if count == 0:
    print("ERROR: 対象文字列が見つかりません")
    # 現在のコードを確認
    import re
    matches = re.findall(r"const valuationReason = row\[.*?\];", text)
    print("現在のコード:", matches)
else:
    text = text.replace(old_str, new_str)
    with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print(f"✅ {count}箇所を修正しました")
    print(f"  変更前: {old_str}")
    print(f"  変更後: {new_str}")
