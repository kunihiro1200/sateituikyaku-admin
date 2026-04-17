"""
BuyerService の create() と updateWithSync() から
property_listings の select に含まれている key_info を除去する
（key_info は property_listings テーブルに存在しない）
"""

target = 'backend/src/services/BuyerService.ts'

with open(target, 'rb') as f:
    content = f.read().decode('utf-8')

# 両メソッドで同じ select 文が使われているので一括置換
old_select = "'address, display_address, price, sales_assignee, pre_viewing_notes, key_info, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking'"
new_select = "'address, display_address, price, sales_assignee, pre_viewing_notes, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking'"

count = content.count(old_select)
if count == 0:
    print('ERROR: 対象箇所が見つかりません')
    exit(1)

content = content.replace(old_select, new_select)
print(f'OK: {count}箇所の select から key_info を除去しました')

# key_info の appendData/allowedData への代入も除去
old_key_info_append = "              appendData.key_info = propertyListing.key_info ?? null;\n"
old_key_info_allowed = "          allowedData.key_info = propertyListing.key_info ?? null;\n"

if old_key_info_append in content:
    content = content.replace(old_key_info_append, '')
    print('OK: appendData.key_info の代入を除去しました')

if old_key_info_allowed in content:
    content = content.replace(old_key_info_allowed, '')
    print('OK: allowedData.key_info の代入を除去しました')

with open(target, 'wb') as f:
    f.write(content.encode('utf-8'))

print('完了')
