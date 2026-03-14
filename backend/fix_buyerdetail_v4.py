"""
BuyerDetailPage.tsx の文字化けを修正。
文字化けパターン: Shift-JISのバイト列をUTF-8として誤解釈して保存したもの。
各Unicodeコードポイントの下位バイトを取り出してShift-JISとして再デコードする。
"""

def fix_mojibake_text(text):
    """
    文字化けした文字列を修正する。
    文字化けした文字のUnicodeコードポイントの下位バイトを
    Shift-JISバイト列として再デコードする。
    """
    # 文字化けしている文字の判定
    # これらはShift-JISのバイト列がUTF-8として誤解釈されたもの
    # UTF-8の2バイト文字: 0xC0-0xDF + 0x80-0xBF → U+0080 to U+07FF
    # UTF-8の3バイト文字: 0xE0-0xEF + 2*(0x80-0xBF) → U+0800 to U+FFFF
    
    # Shift-JISの文字化けパターンを検出
    # Shift-JISの第1バイト: 0x81-0x9F, 0xE0-0xFC
    # Shift-JISの第2バイト: 0x40-0x7E, 0x80-0xFC
    
    result = []
    i = 0
    
    while i < len(text):
        ch = text[i]
        code = ord(ch)
        
        # 文字化けの可能性がある文字を検出
        # UTF-8の2バイト文字として誤解釈されたShift-JIS文字
        # U+0080-U+00FF: latin-1範囲（Shift-JISの1バイト目または2バイト目）
        if 0x0080 <= code <= 0x00FF:
            # 連続するlatin-1文字を収集
            seq_bytes = []
            j = i
            while j < len(text) and 0x0080 <= ord(text[j]) <= 0x00FF:
                seq_bytes.append(ord(text[j]))
                j += 1
            
            try:
                decoded = bytes(seq_bytes).decode('shift_jis')
                result.append(decoded)
                i = j
                continue
            except Exception:
                pass
        
        # U+7E00-U+7FFF, U+8000-U+9FFF 範囲の文字（文字化けしたShift-JIS）
        # これらはShift-JISの2バイト文字がUTF-8の3バイト文字として誤解釈されたもの
        # 元のShift-JISバイト列を復元する
        # UTF-8の3バイト: 0xE? 0x8? 0x8? → U+????
        # Shift-JISの2バイト: 0x?? 0x??
        # 変換: Unicodeコードポイントからバイト列を復元
        
        # 文字化けした文字の特徴的なパターン
        # 繝 = U+7E1D, 縺 = U+7E1A, 繧 = U+7E27 など
        # これらはShift-JISのバイト列をUTF-8として読んだ結果
        
        # UTF-8エンコードしてShift-JISとして再デコード
        if 0x0100 <= code <= 0xFFFF:
            try:
                utf8_bytes = ch.encode('utf-8')
                # UTF-8バイト列をShift-JISとして解釈
                decoded = utf8_bytes.decode('shift_jis')
                # デコード結果が正常な日本語かチェック
                if all(0x3000 <= ord(c) <= 0x9FFF or 0xFF00 <= ord(c) <= 0xFFEF or ord(c) < 0x80 for c in decoded):
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

# テスト: 文字化けした文字のUTF-8バイト列を確認
sample_chars = ['繝', '縺', '繧', '蝠', '蟶']
print('Sample char analysis:')
for ch in sample_chars:
    utf8 = ch.encode('utf-8')
    print(f'  {ch} (U+{ord(ch):04X}) -> UTF-8: {utf8.hex()} -> SJis decode: ', end='')
    try:
        print(utf8.decode('shift_jis'))
    except Exception as e:
        print(f'Error: {e}')

fixed = fix_mojibake_text(text)

# 確認
lines = fixed.split('\n')
print('\nSample lines 127-145:')
for i, line in enumerate(lines[126:145], 127):
    print(f'{i}: {line[:100]}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(fixed)
print('\nDone')
