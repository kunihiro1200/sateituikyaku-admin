with open('src/index.ts', 'rb') as f:
    content = f.read()
decoded = content.decode('utf-8')
lines = decoded.split('\n')

# 161行目と312行目の実際の内容を確認
for i in [160, 311]:
    line = lines[i]
    # sheetName部分のバイト列を確認
    start = line.find("|| '")
    if start >= 0:
        snippet = line[start:start+20]
        print('Line ' + str(i+1) + ' snippet: ' + repr(snippet))
        print('Bytes: ' + snippet.encode('utf-8').hex())
