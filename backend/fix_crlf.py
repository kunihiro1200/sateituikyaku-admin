with open('src/index.ts', 'rb') as f:
    content = f.read()

# \r\r\r\n や \r\r\n を \r\n に正規化
import re
# まず全ての \r を除去してから \n を \r\n に変換
text = content.decode('utf-8')

# 複数の \r を1つに
text = re.sub(r'\r+\n', '\r\n', text)
text = re.sub(r'\r+', '\r\n', text)

# \r\n\r\n\r\n のような連続改行を確認
lines = text.split('\r\n')
print('Total lines: ' + str(len(lines)))

# 空行が連続している箇所を確認（最初の10件）
count = 0
for i in range(len(lines)-2):
    if lines[i].strip() == '' and lines[i+1].strip() == '' and lines[i+2].strip() == '':
        if count < 5:
            print('Triple empty at line ' + str(i+1))
        count += 1
print('Total triple-empty occurrences: ' + str(count))

with open('src/index.ts', 'w', encoding='utf-8-sig', newline='\r\n') as f:
    f.write(text)
print('Done')
