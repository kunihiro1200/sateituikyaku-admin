with open('src/index.ts', 'rb') as f:
    content = f.read()
decoded = content.decode('utf-8')

replacements = [
    ("\u96cb\u8375\u9023\u8f9f\u30ea\u30b9\u30c8", "\u8cb7\u4e3b\u30ea\u30b9\u30c8"),
    ("\u87ba\u8375\u30ea\u30b9\u30c8", "\u58f2\u4e3b\u30ea\u30b9\u30c8"),
]

new_content = decoded
for old, new in replacements:
    if old in new_content:
        new_content = new_content.replace(old, new)
        print('Replaced: ' + old + ' -> ' + new)
    else:
        print('NOT FOUND: ' + old)

with open('src/index.ts', 'w', encoding='utf-8-sig', newline='\r\n') as f:
    f.write(new_content)
print('Done')
