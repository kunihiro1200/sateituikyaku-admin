"""
文字化けパターンを詳しく分析する - 正しいアプローチを見つける
"""

# 現在のファイルの文字化けした文字
# 現在のファイルは fix_buyerdetail_v5.py で変換済みなので、
# git から元のファイルを確認する必要がある

# まず、現在のファイルの状態を確認
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
line119 = lines[118]
print(f'Current line 119: {repr(line119[:80])}')

# 現在の文字化けした文字を分析
# '陋ｻ晁ｦ荵晢ｽｰ' が '初見か' になるべき
# 現在の文字化け: 陋(U+964B) ｻ(U+FF7B) 晁(U+6641) ｦ(U+FF66) 荵(U+8835) 晢(U+6662) ｽ(U+FF7D) ｰ(U+FF70)

# 正しい '初見か' のShift-JISバイト列
correct = '初見か'
sjis_bytes = correct.encode('shift_jis')
print(f'\nCorrect Shift-JIS bytes for "初見か": {sjis_bytes.hex()}')
print(f'Bytes: {" ".join(f"{b:02x}" for b in sjis_bytes)}')

# Shift-JISバイト列をUTF-8として読んだ場合
print(f'\nTrying to decode Shift-JIS bytes as UTF-8:')
try:
    decoded = sjis_bytes.decode('utf-8')
    print(f'  Result: {repr(decoded)}')
except Exception as e:
    print(f'  Error: {e}')

# 別のアプローチ: Shift-JISバイト列をlatin-1として読んだ場合
print(f'\nTrying to decode Shift-JIS bytes as latin-1:')
try:
    decoded = sjis_bytes.decode('latin-1')
    print(f'  Result: {repr(decoded)}')
    # そのlatin-1文字列をShift-JISとしてエンコードしてUTF-8としてデコード
    re_encoded = decoded.encode('shift_jis')
    print(f'  Re-encoded as Shift-JIS: {re_encoded.hex()}')
    re_decoded = re_encoded.decode('utf-8')
    print(f'  Re-decoded as UTF-8: {repr(re_decoded)}')
except Exception as e:
    print(f'  Error: {e}')

# 現在の文字化けした文字のShift-JISバイト列
print()
mojibake_current = '陋ｻ晁ｦ荵晢ｽｰ'
print(f'Current mojibake: {repr(mojibake_current)}')
try:
    sjis = mojibake_current.encode('shift_jis')
    print(f'Shift-JIS bytes: {sjis.hex()}')
    # UTF-8としてデコード
    try:
        utf8_decoded = sjis.decode('utf-8')
        print(f'UTF-8 decoded: {repr(utf8_decoded)}')
    except Exception as e:
        print(f'UTF-8 decode error: {e}')
except Exception as e:
    print(f'Shift-JIS encode error: {e}')

# 別の文字化けパターンを試す
print()
print('=== Testing various mojibake patterns ===')

# 元の文字化けパターン（fix_v4.py実行前）を再現するために
# git stash や git checkout で元のファイルを取得する必要がある
# ここでは、元のパターンを手動で確認

# 元のパターン（fix_v4.py実行前）: '蛻晁ｦ九°' = '初見か'
# 蛻 = U+8DFB, 晁 = U+6641, ｦ = U+FF66, 九 = U+4E5D, ° = U+00B0

# 元の文字化けパターンを分析
original_mojibake = '蛻晁ｦ九°'
print(f'Original mojibake: {repr(original_mojibake)}')
for ch in original_mojibake:
    utf8 = ch.encode('utf-8')
    print(f'  {repr(ch)} U+{ord(ch):04X} -> UTF-8: {utf8.hex()}')

# 全バイト列
all_bytes = original_mojibake.encode('utf-8')
print(f'All UTF-8 bytes: {all_bytes.hex()}')

# Shift-JISとしてデコード
try:
    decoded = all_bytes.decode('shift_jis')
    print(f'Shift-JIS decoded: {repr(decoded)}')
except Exception as e:
    print(f'Shift-JIS decode error: {e}')

# cp932として試み
try:
    decoded = all_bytes.decode('cp932')
    print(f'CP932 decoded: {repr(decoded)}')
except Exception as e:
    print(f'CP932 decode error: {e}')
