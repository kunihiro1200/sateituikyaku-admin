"""
元のファイルの文字化けパターンを正確に分析する
"""

# 元のファイル（UTF-16）を読み込む
with open('backend/buyerdetail_original.bin', 'rb') as f:
    data = f.read()
original_text = data.decode('utf-16')

# 元のファイルの文字化けした文字を詳しく分析
# '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ' = '問合時ヒアリング' のはず

mojibake = '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ'
correct = '問合時ヒアリング'

print('=== Mojibake chars ===')
for ch in mojibake:
    code = ord(ch)
    utf8 = ch.encode('utf-8')
    print(f'  {repr(ch)} U+{code:04X} -> UTF-8: {utf8.hex()}')

print()
print('=== Correct chars ===')
for ch in correct:
    code = ord(ch)
    utf8 = ch.encode('utf-8')
    sjis = ch.encode('shift_jis')
    print(f'  {repr(ch)} U+{code:04X} -> UTF-8: {utf8.hex()}, Shift-JIS: {sjis.hex()}')

print()
# 正しい文字のShift-JISバイト列を全部つなげる
correct_sjis = correct.encode('shift_jis')
print(f'Correct Shift-JIS bytes: {correct_sjis.hex()}')
print(f'Bytes: {" ".join(f"{b:02x}" for b in correct_sjis)}')

# そのShift-JISバイト列をUTF-8として読んだ場合
print()
print('=== Shift-JIS bytes decoded as UTF-8 ===')
try:
    decoded = correct_sjis.decode('utf-8')
    print(f'Result: {repr(decoded)}')
except Exception as e:
    print(f'Error: {e}')
    # エラーが出る場合、バイト列を確認
    print(f'Bytes: {" ".join(f"{b:02x}" for b in correct_sjis)}')

# 別のアプローチ: Shift-JISバイト列をlatin-1として読んだ場合
print()
print('=== Shift-JIS bytes decoded as latin-1 ===')
try:
    decoded_latin1 = correct_sjis.decode('latin-1')
    print(f'Result: {repr(decoded_latin1)}')
    # その文字列のUnicodeコードポイントを確認
    for ch in decoded_latin1:
        print(f'  {repr(ch)} U+{ord(ch):04X}')
except Exception as e:
    print(f'Error: {e}')

# 元のファイルの文字化けした文字のUnicodeコードポイントを確認
print()
print('=== Mojibake char code points ===')
for ch in mojibake:
    code = ord(ch)
    # このコードポイントをlatin-1でエンコードできるか？
    try:
        latin1 = ch.encode('latin-1')
        print(f'  {repr(ch)} U+{code:04X} -> latin-1: {latin1.hex()}')
    except:
        print(f'  {repr(ch)} U+{code:04X} -> cannot encode as latin-1')

# 元のファイルの文字化けパターンを理解する
# 元のファイルはShift-JISでエンコードされていた
# それをUTF-8として読み込んだ
# UTF-8として読み込む際、無効なバイト列は置換文字（?）になる
# しかし、元のファイルには文字化けした文字が残っている
# これは、Shift-JISのバイト列の一部がUTF-8として有効だったため

# 正しい変換方法を見つける
print()
print('=== Finding correct conversion ===')

# 元のファイルの文字化けした文字のUTF-8バイト列
mojibake_utf8 = mojibake.encode('utf-8')
print(f'Mojibake UTF-8 bytes: {mojibake_utf8.hex()}')

# 正しい文字のShift-JISバイト列
correct_sjis = correct.encode('shift_jis')
print(f'Correct Shift-JIS bytes: {correct_sjis.hex()}')

# 比較
print()
print('Mojibake UTF-8:', ' '.join(f'{b:02x}' for b in mojibake_utf8))
print('Correct SJIS:  ', ' '.join(f'{b:02x}' for b in correct_sjis))

# 元のファイルの文字化けした文字のUTF-8バイト列から
# 正しいShift-JISバイト列を復元できるか？
# 各バイトを確認
print()
print('Byte-by-byte comparison:')
for i, (mb, cb) in enumerate(zip(mojibake_utf8, correct_sjis)):
    print(f'  [{i}] mojibake: 0x{mb:02x}, correct: 0x{cb:02x}, diff: {mb - cb}')
