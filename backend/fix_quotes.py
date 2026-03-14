with open('src/index.ts', 'rb') as f:
    content = f.read()
decoded = content.decode('utf-8')

# クォートが閉じていない箇所を修正
decoded = decoded.replace("'買主リスト,", "'買主リスト',")
decoded = decoded.replace("'売主リスト,", "'売主リスト',")

with open('src/index.ts', 'w', encoding='utf-8-sig', newline='') as f:
    f.write(decoded)
print('Done')
