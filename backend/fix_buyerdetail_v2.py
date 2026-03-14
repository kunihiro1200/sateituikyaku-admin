"""
BuyerDetailPage.tsx の文字化けを修正するスクリプト。
文字化けした文字列（latin-1バイト列がUTF-8として誤保存されたもの）を
Shift-JISとして再デコードして正しい日本語に変換する。
"""

def fix_mojibake_sequence(text):
    """
    文字化けした文字列を修正する。
    latin-1範囲(0x80-0xFF)の文字が連続している場合、
    それをバイト列に変換してShift-JISとしてデコードする。
    """
    result = []
    i = 0
    while i < len(text):
        ch = text[i]
        code = ord(ch)
        
        # latin-1範囲の文字（0x80-0xFF）を収集
        if 0x80 <= code <= 0xFF:
            seq = []
            j = i
            while j < len(text) and 0x80 <= ord(text[j]) <= 0xFF:
                seq.append(ord(text[j]))
                j += 1
            
            # Shift-JISとしてデコード試行
            try:
                decoded = bytes(seq).decode('shift_jis')
                result.append(decoded)
                i = j
                continue
            except Exception:
                # デコード失敗の場合、1文字ずつ処理
                pass
        
        # 文字化けしたUnicode文字（Shift-JISの2バイト文字がUTF-8として誤解釈されたもの）
        # 例: 繝 (U+7E1D), 縺 (U+7E1A), 繧 (U+7E27) など
        # これらはShift-JISのバイト列をUTF-8として読んだ結果
        # latin-1でエンコードしてShift-JISとして再デコード
        if code > 0x7F:
            try:
                byte_val = ch.encode('latin-1')
                # 次の文字も確認
                if i + 1 < len(text):
                    next_code = ord(text[i + 1])
                    if next_code > 0x7F:
                        try:
                            two_bytes = ch.encode('latin-1') + text[i+1].encode('latin-1')
                            decoded = two_bytes.decode('shift_jis')
                            result.append(decoded)
                            i += 2
                            continue
                        except Exception:
                            pass
                # 1バイトとして処理
                decoded = byte_val.decode('shift_jis', errors='replace')
                result.append(decoded)
                i += 1
                continue
            except Exception:
                pass
        
        result.append(ch)
        i += 1
    
    return ''.join(result)


with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 文字化けしている文字の範囲を確認
mojibake_chars = [(i, hex(ord(ch)), ch) for i, ch in enumerate(text) if 0x80 <= ord(ch) <= 0xFF]
print(f'Before: {len(mojibake_chars)} mojibake chars')

fixed = fix_mojibake_sequence(text)

mojibake_after = [(i, hex(ord(ch)), ch) for i, ch in enumerate(fixed) if 0x80 <= ord(ch) <= 0xFF]
print(f'After: {len(mojibake_after)} mojibake chars')

# サンプル確認
lines = fixed.split('\n')
print('\nSample lines 127-155:')
for i, line in enumerate(lines[126:155], 127):
    print(f'{i}: {line[:100]}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(fixed)
print('\nDone')
