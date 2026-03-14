"""
文字化けパターンを詳しく分析する
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 問題の行を見つける
lines = text.split('\n')

# 118行目付近を確認
print('=== Lines 118-125 (raw chars) ===')
for i, line in enumerate(lines[117:125], 118):
    print(f'Line {i}: {repr(line[:80])}')

print()

# 文字化けした文字のコードポイントを確認
sample = lines[118]  # INQUIRY_HEARING_QUICK_INPUTS の最初の行
print(f'=== Line 119 chars ===')
print(f'Line: {repr(sample)}')
for j, ch in enumerate(sample[:50]):
    code = ord(ch)
    if code > 0x7F:
        print(f'  pos {j}: {repr(ch)} U+{code:04X}')

print()

# 正しい日本語テキストのサンプル
# '初見か' の正しいUnicodeコードポイント
correct = '初見か'
print(f'=== Correct Japanese ===')
for ch in correct:
    print(f'  {repr(ch)} U+{ord(ch):04X}')

print()

# 文字化けした '陋ｻ晁ｦ九ｰ' を分析
mojibake = '陋ｻ晁ｦ九ｰ'
print(f'=== Mojibake chars ===')
for ch in mojibake:
    code = ord(ch)
    print(f'  {repr(ch)} U+{code:04X}')
    # UTF-8エンコード
    utf8 = ch.encode('utf-8')
    print(f'    UTF-8: {utf8.hex()}')
    # latin-1エンコード試み
    try:
        latin1 = ch.encode('latin-1')
        print(f'    latin-1: {latin1.hex()}')
    except:
        print(f'    latin-1: cannot encode')

print()

# 別のアプローチ: ファイルをlatin-1として読み直してShift-JISとしてデコード
print('=== Try reading as latin-1 then decode as shift-jis ===')
try:
    with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
        raw = f.read()
    
    # 最初の200バイトを確認
    print(f'First 200 bytes: {raw[:200].hex()}')
    print()
    
    # UTF-8として読んだ場合の確認
    text_utf8 = raw.decode('utf-8')
    print(f'UTF-8 decode OK, length: {len(text_utf8)}')
    
    # 問題の行を確認
    lines_utf8 = text_utf8.split('\n')
    print(f'Line 119: {repr(lines_utf8[118][:80])}')
    
except Exception as e:
    print(f'Error: {e}')
