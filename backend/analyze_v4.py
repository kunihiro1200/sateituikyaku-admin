"""
元のファイル（UTF-16）の文字化けパターンを分析して変換方法を確立する
"""

# 元のファイル（UTF-16）を読み込む
with open('backend/buyerdetail_original.bin', 'rb') as f:
    data = f.read()
original_text = data.decode('utf-16')

# 元のファイルの文字化けした文字のUTF-8バイト列をShift-JISとしてデコードする関数
def fix_original_mojibake(text):
    """
    元のファイルの文字化けを修正する。
    文字化けパターン: UTF-8バイト列をShift-JISとして読んだもの
    修正: 文字化けした文字のUTF-8バイト列をShift-JISとしてデコード
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
        seq_chars = []
        j = i
        while j < len(text) and ord(text[j]) >= 0x80:
            seq_chars.append(text[j])
            j += 1
        
        # UTF-8バイト列に変換
        seq_str = ''.join(seq_chars)
        try:
            utf8_bytes = seq_str.encode('utf-8')
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

# テスト
test = '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ'
print(f'Test input: {repr(test)}')
result = fix_original_mojibake(test)
print(f'Test result: {repr(result)}')

print()

# 元のファイルの115行目を確認
orig_lines = original_text.split('\n')
print(f'Original line 115: {repr(orig_lines[114][:100])}')
fixed_line = fix_original_mojibake(orig_lines[114])
print(f'Fixed line 115: {repr(fixed_line[:100])}')

print()

# 全体を変換
print('Converting full file...')
fixed_text = fix_original_mojibake(original_text)
fixed_lines = fixed_text.split('\n')
print(f'Fixed lines: {len(fixed_lines)}')

# サンプル確認
print('\nSample lines 113-130:')
for i, line in enumerate(fixed_lines[112:130], 113):
    print(f'{i}: {line[:120]}')

# ファイルに書き込む
output_path = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(fixed_text)
print(f'\nWritten to {output_path}')
