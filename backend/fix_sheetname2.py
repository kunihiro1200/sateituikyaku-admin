with open('src/index.ts', 'rb') as f:
    content = f.read()
decoded = content.decode('utf-8')

# 買主リスト: e99b8befbdb7e88db3efbdbbe7b99defbdaae7b9a7efbdb9e7b99de383bb
# 売主リスト: e89ea2efbdb2e88db3efbdbbe7b99defbdaae7b9a7efbdb9e7b99de383bb
buyer_list_mojibake = bytes.fromhex('e99b8befbdb7e88db3efbdbbe7b99defbdaae7b9a7efbdb9e7b99de383bb').decode('utf-8')
seller_list_mojibake = bytes.fromhex('e89ea2efbdb2e88db3efbdbbe7b99defbdaae7b9a7efbdb9e7b99de383bb').decode('utf-8')

print('buyer mojibake: ' + repr(buyer_list_mojibake))
print('seller mojibake: ' + repr(seller_list_mojibake))

new_content = decoded
if buyer_list_mojibake in new_content:
    new_content = new_content.replace(buyer_list_mojibake, '\u8cb7\u4e3b\u30ea\u30b9\u30c8')
    print('Replaced buyer list')
else:
    print('buyer list NOT FOUND')

if seller_list_mojibake in new_content:
    new_content = new_content.replace(seller_list_mojibake, '\u58f2\u4e3b\u30ea\u30b9\u30c8')
    print('Replaced seller list')
else:
    print('seller list NOT FOUND')

with open('src/index.ts', 'w', encoding='utf-8-sig', newline='') as f:
    f.write(new_content)
print('Done')
