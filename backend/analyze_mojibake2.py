"""
文字化けの正確なパターンを分析する。
文字化けした文字列と正しい文字列を対応させて変換テーブルを作る。
"""

# 文字化けした文字列と正しい文字列のペアを手動で特定する
# ファイルから文字化けしている行を読み取る
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 文字化けしている行を表示（行番号付き）
print('=== 文字化けしている行（最初の50行）===')
count = 0
for i, line in enumerate(lines, 1):
    # 文字化けの特徴的な文字を含む行
    mojibake_count = sum(1 for c in line if 0x7E00 <= ord(c) <= 0x9FFF or 0xFF61 <= ord(c) <= 0xFF9F)
    if mojibake_count > 2:
        print(f'Line {i}: {line.rstrip()[:120]}')
        count += 1
        if count >= 50:
            break

print(f'\nTotal mojibake lines found: {count}')

# 特定の文字化けパターンを分析
# '蝠丞粋縺帛・螳ｹ' の各文字のUTF-8バイト列を確認
print('\n=== 文字化けパターン分析 ===')
samples = [
    ('蝠丞粋縺帛・螳ｹ', '問合時情報'),  # 推測
    ('蝓ｺ譛ｬ諠・ｱ', '基本情報'),  # 推測
    ('雋ｷ荳ｻ逡ｪ蜿ｷ', '買主番号'),  # 推測
    ('髮ｻ隧ｱ逡ｪ蜿ｷ', '電話番号'),  # 推測
    ('繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ', 'メールアドレス'),  # 推測
]

for mojibake, expected in samples:
    print(f'\n文字化け: {mojibake}')
    print(f'期待値:   {expected}')
    
    # 文字化けした文字列のUTF-8バイト列
    utf8_bytes = mojibake.encode('utf-8')
    print(f'UTF-8バイト列: {utf8_bytes.hex()}')
    
    # 期待値のShift-JISバイト列
    try:
        sjis_bytes = expected.encode('shift_jis')
        print(f'期待値のSJIS: {sjis_bytes.hex()}')
        
        # UTF-8バイト列とSJISバイト列を比較
        # もし一致するパターンがあれば変換方法が分かる
    except Exception as e:
        print(f'SJIS encode error: {e}')
