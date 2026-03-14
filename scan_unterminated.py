with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

lines = content.split(b'\n')
print(f'Total lines: {len(lines)}')

# 改行が文字列リテラル内に混入している行を探す
# シングルクォートが奇数個の行を探す
for i, line in enumerate(lines):
    try:
        decoded = line.decode('utf-8')
    except:
        print(f'Line {i+1}: DECODE ERROR')
        continue
    
    # コメント行はスキップ
    stripped = decoded.strip()
    if stripped.startswith('//'):
        continue
    
    # シングルクォートの数を数える（エスケープを除く）
    count = decoded.count("'") - decoded.count("\\'")
    if count % 2 != 0:
        print(f'Line {i+1} (odd quotes={count}): {decoded[:100]}')
