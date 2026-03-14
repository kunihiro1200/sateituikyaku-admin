"""
BuyerDetailPage.tsx の文字化けを正しく修正する。

文字化けのメカニズム:
1. 元のファイルはUTF-8でエンコードされていた（正しい日本語）
2. それをShift-JISとして誤って読み込んだ
3. Shift-JISとして読んだ文字列をUTF-8として保存した
4. 結果: 文字化けした文字が保存された

修正方法:
- 文字化けした文字をShift-JISでエンコード
- そのバイト列をUTF-8としてデコード
- これで元の正しい日本語が復元される

検証:
- '蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ'.encode('shift_jis').decode('utf-8') = '問合時ヒアリング' ✓
"""

def fix_mojibake(text):
    """
    文字化けした文字列を修正する。
    文字化けした文字をShift-JISでエンコードして、UTF-8としてデコードする。
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
        
        # 非ASCII文字: 連続する非ASCII文字をまとめて処理
        seq_chars = []
        j = i
        while j < len(text) and ord(text[j]) >= 0x80:
            seq_chars.append(text[j])
            j += 1
        
        seq_str = ''.join(seq_chars)
        
        # Shift-JISでエンコードしてUTF-8としてデコード
        try:
            sjis_bytes = seq_str.encode('shift_jis')
            decoded = sjis_bytes.decode('utf-8')
            result.append(decoded)
            i = j
            continue
        except Exception:
            pass
        
        # 失敗した場合は1文字ずつ試す
        converted = False
        for k in range(len(seq_chars), 0, -1):
            sub_str = ''.join(seq_chars[:k])
            try:
                sjis_bytes = sub_str.encode('shift_jis')
                decoded = sjis_bytes.decode('utf-8')
                result.append(decoded)
                i += k
                converted = True
                break
            except Exception:
                continue
        
        if not converted:
            # 変換できない場合はそのまま
            result.append(ch)
            i += 1
    
    return ''.join(result)


# 元のファイル（UTF-16）を読み込む
with open('backend/buyerdetail_original.bin', 'rb') as f:
    data = f.read()
original_text = data.decode('utf-16')

print(f'Original file size: {len(original_text)} chars')

# テスト
test_cases = [
    ('蝠丞粋譎ゅヲ繧｢繝ｪ繝ｳ繧ｰ', '問合時ヒアリング'),
    ('蝠丞粋譎ら｢ｺ蠎ｦ', '問合時確度'),
    ('縲仙撫蜷医Γ繝ｼ繝ｫ縲鷹崕隧ｱ蟇ｾ蠢・', '【問合メール】電話対応'),
    ('3蝗樊楔髮ｻ遒ｺ隱肴ｸ医∩', '3回架電確認済み'),
    ('蜀・ｦｧ菫・ｲ繝｡繝ｼ繝ｫ', '内覧促進メール'),
    ('驟堺ｿ｡縺ｮ譛臥┌', '配信の有無'),
    ('蜿嶺ｻ俶律', '受付日'),
    ('蛻晏虚諡・ｽ・', '初動担当'),
    ('蝠丞粋縺帛・', '問合せ元'),
    ('谺｡髮ｻ譌･', '次架電日'),
    ('蝓ｺ譛ｬ諠・ｱ', '基本情報'),
    ('雋ｷ荳ｻ逡ｪ蜿ｷ', '買主番号'),
    ('豌丞錐繝ｻ莨夂､ｾ蜷・', '氏名・会社名'),
    ('髮ｻ隧ｱ逡ｪ蜿ｷ', '電話番号'),
    ('繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ', 'メールアドレス'),
    ('繝｡繧｢繝臥｢ｺ隱・', 'メアド確認'),
    ('豕穂ｺｺ蜷・', '法人名'),
]

print('\n=== Test cases ===')
all_pass = True
for mojibake, expected in test_cases:
    result = fix_mojibake(mojibake)
    status = '✓' if result == expected else '✗'
    if result != expected:
        all_pass = False
    print(f'{status} {repr(mojibake)[:30]} -> {repr(result)} (expected: {repr(expected)})')

print()
if all_pass:
    print('All tests passed!')
else:
    print('Some tests failed!')

# 全体を変換
print('\nConverting full file...')
fixed_text = fix_mojibake(original_text)
fixed_lines = fixed_text.split('\n')
print(f'Fixed lines: {len(fixed_lines)}')

# サンプル確認
print('\nSample lines 110-135:')
for i, line in enumerate(fixed_lines[109:135], 110):
    print(f'{i}: {line[:120]}')

# ファイルに書き込む
output_path = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(fixed_text)
print(f'\nWritten to {output_path}')
