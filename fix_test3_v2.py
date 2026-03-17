"""
テスト3の修正スクリプト v2
改行コードの問題を考慮して修正
"""

with open('frontend/frontend/src/__tests__/bug-condition-exploration.test.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 問題の行を確認
lines = text.split('\n')
for i, line in enumerate(lines):
    if 'api.get' in line and 'waitFor' in lines[i-1] if i > 0 else False:
        print(f"Line {i}: {repr(line)}")
    if 'toHaveBeenCalled' in line:
        print(f"Line {i}: {repr(line)}")
    if 'Promise の reject' in line:
        print(f"Line {i}: {repr(line)}")

print("---")
print("Searching for the block...")

# waitFor ブロックを含む部分を探す
idx = text.find('    // api.get が呼ばれるまで待つ（useEffect が実行されるのを確認）')
print(f"Found at index: {idx}")
if idx >= 0:
    print(repr(text[idx:idx+300]))
