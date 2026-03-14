"""
BuyerDetailPage.tsx の文字化けを修正。

文字化けの原因:
- 元のファイルはShift-JISでエンコードされていた
- それをlatin-1（またはcp1252）として読み込み、UTF-8として保存した
- 結果: Shift-JISのバイト列がlatin-1のコードポイントとしてUnicodeに変換された

修正方法:
- latin-1でエンコードしてShift-JISとしてデコードする
- ただし、ASCII範囲（0x00-0x7F）の文字はそのまま
"""

import re

def fix_mojibake(text):
    """
    文字化けした文字列を修正する。
    latin-1でエンコードしてShift-JISとしてデコードする。
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
        
        # latin-1範囲（0x80-0xFF）の文字を収集してShift-JISとしてデコード
        if 0x80 <= code <= 0xFF:
            seq_bytes = []
            j = i
            while j < len(text) and 0x80 <= ord(text[j]) <= 0xFF:
                seq_bytes.append(ord(text[j]))
                j += 1
            
            try:
                decoded = bytes(seq_bytes).decode('shift_jis')
                result.append(decoded)
                i = j
                continue
            except Exception:
                # デコード失敗時は1文字ずつ試す
                result.append(ch)
                i += 1
                continue
        
        # それ以外（U+0100以上）はそのまま
        result.append(ch)
        i += 1
    
    return ''.join(result)


# ファイルを読み込む
filepath = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

print(f'File size: {len(text)} chars')

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
