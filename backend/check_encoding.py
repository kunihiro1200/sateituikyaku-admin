with open('src/index.ts', 'rb') as f:
    content = f.read()
decoded = content.decode('utf-8')
lines = decoded.split('\n')

# sheetName の行を探す
for i, line in enumerate(lines, start=1):
    if 'sheetName' in line and 'SHEET_NAME' in line:
        print(str(i) + ': ' + repr(line))

# rowData の文字化け行を探す
for i, line in enumerate(lines, start=1):
    if 'nextBuyerNumber.toString()' in line:
        print(str(i) + ': ' + repr(line))
    if 'jstDateString' in line and 'rowData' not in line and 'const' not in line:
        print(str(i) + ': ' + repr(line))
