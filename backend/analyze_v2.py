"""
文字化けパターンを詳しく分析する - バイトレベル
"""

# 正しい日本語テキスト
correct = '初見か'
print('=== Correct Japanese UTF-8 bytes ===')
for ch in correct:
    utf8 = ch.encode('utf-8')
    print(f'  {repr(ch)} U+{ord(ch):04X} -> UTF-8: {utf8.hex()} ({" ".join(f"{b:02x}" for b in utf8)})')

print()

# 文字化けした文字
mojibake = '陋ｻ晁ｦ九ｰ'
print('=== Mojibake chars ===')
for ch in mojibake:
    utf8 = ch.encode('utf-8')
    print(f'  {repr(ch)} U+{ord(ch):04X} -> UTF-8: {utf8.hex()} ({" ".join(f"{b:02x}" for b in utf8)})')

print()

# 文字化けした文字のUTF-8バイト列を全部つなげる
all_bytes = b''
for ch in mojibake:
    all_bytes += ch.encode('utf-8')
print(f'All UTF-8 bytes: {all_bytes.hex()}')
print(f'Bytes: {" ".join(f"{b:02x}" for b in all_bytes)}')

# Shift-JISとしてデコード試み
print()
print('=== Try Shift-JIS decode ===')
try:
    decoded = all_bytes.decode('shift_jis')
    print(f'Decoded: {repr(decoded)}')
except Exception as e:
    print(f'Error: {e}')

# cp932として試み
try:
    decoded = all_bytes.decode('cp932')
    print(f'CP932 decoded: {repr(decoded)}')
except Exception as e:
    print(f'CP932 Error: {e}')

print()

# 正しい '初見か' のUTF-8バイト列
correct_bytes = '初見か'.encode('utf-8')
print(f'Correct UTF-8 bytes: {correct_bytes.hex()}')
print(f'Bytes: {" ".join(f"{b:02x}" for b in correct_bytes)}')

print()

# 文字化けした文字のUTF-8バイト列と正しいバイト列を比較
print('=== Comparison ===')
print(f'Mojibake bytes: {all_bytes.hex()}')
print(f'Correct bytes:  {correct_bytes.hex()}')

# 文字化けした文字のUTF-8バイト列から正しいバイト列を復元できるか？
# 各バイトを確認
print()
print('=== Byte analysis ===')
for i, b in enumerate(all_bytes):
    print(f'  byte[{i}]: 0x{b:02x} ({b})')

print()
print('=== Correct byte analysis ===')
for i, b in enumerate(correct_bytes):
    print(f'  byte[{i}]: 0x{b:02x} ({b})')

# 別のアプローチ: 文字化けした文字をShift-JISとして読んだ場合
print()
print('=== Try encoding mojibake as various encodings ===')
for enc in ['shift_jis', 'cp932', 'euc_jp', 'iso2022_jp']:
    try:
        encoded = mojibake.encode(enc)
        print(f'{enc}: {encoded.hex()}')
        # そのバイト列をUTF-8としてデコード
        try:
            decoded_utf8 = encoded.decode('utf-8')
            print(f'  -> UTF-8 decode: {repr(decoded_utf8)}')
        except:
            pass
        # Shift-JISとしてデコード
        try:
            decoded_sjis = encoded.decode('shift_jis')
            print(f'  -> Shift-JIS decode: {repr(decoded_sjis)}')
        except:
            pass
    except Exception as e:
        print(f'{enc}: Error: {e}')

# 実際のファイルのバイト列を確認
print()
print('=== Raw file bytes around line 119 ===')
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    raw = f.read()

# BOMを確認
print(f'BOM: {raw[:3].hex()}')

# 行119を探す
text = raw.decode('utf-8')
lines = text.split('\n')
line119 = lines[118]
print(f'Line 119: {repr(line119[:60])}')

# line119のバイト列
line119_bytes = line119.encode('utf-8')
print(f'Line 119 UTF-8 bytes (first 60): {line119_bytes[:60].hex()}')
