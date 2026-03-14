with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

lines = content.split(b'\n')

# バックティックが奇数の行を探す（複数行テンプレートリテラルの開始/終了）
backtick_open = False
for i, line in enumerate(lines):
    try:
        decoded = line.decode('utf-8')
    except:
        print(f'Line {i+1}: DECODE ERROR')
        continue
    
    count = decoded.count('`')
    if count % 2 != 0:
        print(f'Line {i+1} (backtick toggle, was_open={backtick_open}): {decoded[:120]}')
        backtick_open = not backtick_open

print(f'Final backtick_open state: {backtick_open}')
