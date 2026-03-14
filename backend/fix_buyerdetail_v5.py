"""
BuyerDetailPage.tsx の文字化けを修正。

文字化けの原因:
- 元のファイルはUTF-8でエンコードされていた
- そのUTF-8バイト列をShift-JISとして誤解釈して読み込んだ
- 結果: UTF-8の各バイトがShift-JISの文字として解釈された

例:
- '初' (U+521D) → UTF-8: e5 88 9d
- Shift-JISとして読むと: e5 88 → '陋', 9d → 単独バイト
- 実際の文字化け: '陋ｻ晁ｦ九ｰ' = '初見か' のUTF-8バイト列をShift-JISで読んだもの

修正方法:
- 文字化けした文字のUTF-8バイト列を取得
- そのバイト列をShift-JISとしてデコード
"""

def fix_mojibake(text):
    """
    文字化けした文字列を修正する。
    各文字のUTF-8バイト列をShift-JISとしてデコードする。
    """
    result = []
    i = 0
    
    while i < len(text):
        ch = text[i]
        code = ord(ch)
        
        # ASCII範囲はそのまま
        if code < 0x80:
            result.append(ch)
            i += 1
            continue
        
        # 非ASCII文字: UTF-8バイト列を収集してShift-JISとしてデコード
        # 連続する非ASCII文字をまとめて処理
        seq_chars = []
        j = i
        while j < len(text) and ord(text[j]) >= 0x80:
            seq_chars.append(text[j])
            j += 1
        
        # UTF-8バイト列に変換
        try:
            utf8_bytes = ''.join(seq_chars).encode('utf-8')
            # Shift-JISとしてデコード
            decoded = utf8_bytes.decode('shift_jis')
            result.append(decoded)
            i = j
            continue
        except Exception:
            # 失敗した場合は1文字ずつ試す
            try:
                utf8_bytes = ch.encode('utf-8')
                decoded = utf8_bytes.decode('shift_jis')
                result.append(decoded)
                i += 1
                continue
            except Exception:
                result.append(ch)
                i += 1
                continue
    
    return ''.join(result)


# ファイルを読み込む
filepath = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

print(f'File size: {len(text)} chars')

# テスト: 特定の文字化けパターンを確認
test_mojibake = '陋ｻ晁ｦ九ｰ'
print(f'\nTest: {repr(test_mojibake)}')
try:
    utf8_bytes = test_mojibake.encode('utf-8')
    print(f'UTF-8 bytes: {utf8_bytes.hex()}')
    decoded = utf8_bytes.decode('shift_jis')
    print(f'Decoded as Shift-JIS: {repr(decoded)}')
except Exception as e:
    print(f'Error: {e}')

# 修正を適用
fixed = fix_mojibake(text)

# サンプル確認
lines = fixed.split('\n')
print('\nSample lines 115-145:')
for i, line in enumerate(lines[114:145], 115):
    print(f'{i}: {line[:120]}')

# 書き込み
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(fixed)

print('\nDone!')
