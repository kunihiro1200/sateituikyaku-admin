"""
文字化けの正確なメカニズムを解明する

元のファイルはShift-JISでエンコードされていた。
それをUTF-8として読み込んだ際に文字化けが発生した。

Shift-JISのバイト列をUTF-8として読む際:
- 有効なUTF-8シーケンスはそのままUnicode文字に変換される
- 無効なバイトは置換文字（U+FFFD）または別の文字に変換される

元のファイルの文字化けした文字 '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ' を分析する
"""

# 正しい文字 '問合時ヒアリング' のShift-JISバイト列
correct = '問合時ヒアリング'
correct_sjis = correct.encode('shift_jis')
print(f'Correct Shift-JIS bytes: {" ".join(f"{b:02x}" for b in correct_sjis)}')

# そのShift-JISバイト列をUTF-8として読んだ場合
# errors='replace' で無効なバイトを置換文字に変換
print()
print('=== Decoding Shift-JIS bytes as UTF-8 (with errors=replace) ===')
decoded_replace = correct_sjis.decode('utf-8', errors='replace')
print(f'Result: {repr(decoded_replace)}')

# errors='surrogateescape' で試す
print()
print('=== Decoding Shift-JIS bytes as UTF-8 (with errors=surrogateescape) ===')
decoded_surr = correct_sjis.decode('utf-8', errors='surrogateescape')
print(f'Result: {repr(decoded_surr)}')

# errors='ignore' で試す
print()
print('=== Decoding Shift-JIS bytes as UTF-8 (with errors=ignore) ===')
decoded_ignore = correct_sjis.decode('utf-8', errors='ignore')
print(f'Result: {repr(decoded_ignore)}')

# 元のファイルの文字化けした文字
mojibake = '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ'
print()
print(f'Mojibake: {repr(mojibake)}')

# 元のファイルの文字化けした文字のShift-JISバイト列
try:
    mojibake_sjis = mojibake.encode('shift_jis')
    print(f'Mojibake Shift-JIS bytes: {" ".join(f"{b:02x}" for b in mojibake_sjis)}')
    # そのバイト列をUTF-8としてデコード
    decoded = mojibake_sjis.decode('utf-8', errors='replace')
    print(f'Decoded as UTF-8: {repr(decoded)}')
except Exception as e:
    print(f'Error: {e}')

# 別のアプローチ: 元のファイルの文字化けした文字のUTF-8バイト列を
# Shift-JISとして読んだ場合
print()
print('=== Mojibake UTF-8 bytes decoded as Shift-JIS ===')
mojibake_utf8 = mojibake.encode('utf-8')
print(f'Mojibake UTF-8 bytes: {" ".join(f"{b:02x}" for b in mojibake_utf8)}')

# バイト列を手動でShift-JISとしてデコード
result = []
i = 0
while i < len(mojibake_utf8):
    b = mojibake_utf8[i]
    # Shift-JISの2バイト文字の第1バイト
    if (0x81 <= b <= 0x9F or 0xE0 <= b <= 0xFC) and i + 1 < len(mojibake_utf8):
        b2 = mojibake_utf8[i+1]
        if 0x40 <= b2 <= 0xFC and b2 != 0x7F:
            try:
                ch = bytes([b, b2]).decode('shift_jis')
                result.append(ch)
                i += 2
                continue
            except:
                pass
    # 1バイト文字
    if b < 0x80:
        result.append(chr(b))
    i += 1

print(f'Manual Shift-JIS decode: {"".join(result)!r}')

# 正しいShift-JISバイト列と比較
print()
print(f'Correct SJIS: {" ".join(f"{b:02x}" for b in correct_sjis)}')
print(f'Mojibake UTF8: {" ".join(f"{b:02x}" for b in mojibake_utf8)}')

# 元のファイルの文字化けパターンを理解するために
# Shift-JISバイト列をUTF-8として読む際の変換を確認
print()
print('=== How Shift-JIS bytes are read as UTF-8 ===')
# 問 = 96 e2 (Shift-JIS)
# UTF-8として読む: 96 は無効な開始バイト、e2 は3バイトシーケンスの開始
# e2 + 次の2バイト = 3バイトUTF-8シーケンス
# 問のShift-JIS: 96 e2
# 合のShift-JIS: 8d 87
# 時のShift-JIS: 8e 9e
# ヒのShift-JIS: 83 71
# アのShift-JIS: 83 41
# リのShift-JIS: 83 8a
# ンのShift-JIS: 83 93
# グのShift-JIS: 83 4f

# 全バイト列: 96 e2 8d 87 8e 9e 83 71 83 41 83 8a 83 93 83 4f
# UTF-8として読む:
# 96 -> 無効 (0x96 は UTF-8の開始バイトとして無効)
# e2 8d 87 -> U+E347 (3バイトシーケンス: e2=1110 0010, 8d=1000 1101, 87=1000 0111)
# 8e -> 無効
# 9e -> 無効
# 83 -> 無効
# 71 -> 'q' (ASCII)
# 83 -> 無効
# 41 -> 'A' (ASCII)
# 83 8a -> 無効
# 83 93 -> 無効
# 83 4f -> 無効

# 実際に確認
test_bytes = bytes([0x96, 0xe2, 0x8d, 0x87, 0x8e, 0x9e, 0x83, 0x71, 0x83, 0x41, 0x83, 0x8a, 0x83, 0x93, 0x83, 0x4f])
print(f'Test bytes: {" ".join(f"{b:02x}" for b in test_bytes)}')
decoded_replace = test_bytes.decode('utf-8', errors='replace')
print(f'Decoded as UTF-8 (replace): {repr(decoded_replace)}')

# errors='surrogateescape'
decoded_surr = test_bytes.decode('utf-8', errors='surrogateescape')
print(f'Decoded as UTF-8 (surrogateescape): {repr(decoded_surr)}')

# 元のファイルの文字化けした文字と比較
print()
print(f'Expected mojibake: {repr(mojibake)}')
print(f'Got (replace): {repr(decoded_replace)}')
