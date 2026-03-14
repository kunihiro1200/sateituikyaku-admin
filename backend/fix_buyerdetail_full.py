import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

def fix_mojibake_char(ch):
    """文字化けした文字（latin-1範囲の文字がShift-JISとして誤解釈されたもの）を修正"""
    code = ord(ch)
    # 0xFF61-0xFF9F: 半角カタカナ（Shift-JISの文字化け）
    # 0x3040-0x30FF: ひらがな・カタカナ（一部文字化け）
    # その他の文字化けパターン
    return ch

def fix_mojibake_sequence(text):
    """文字化けした文字列を修正する"""
    result = []
    i = 0
    while i < len(text):
        ch = text[i]
        code = ord(ch)
        # 文字化けパターン: latin-1範囲の文字が連続している場合
        # これらをバイト列に変換してShift-JISとしてデコード
        if 0x80 <= code <= 0xFF:
            # latin-1範囲の文字を収集
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
            except:
                pass
        result.append(ch)
        i += 1
    return ''.join(result)

fixed = fix_mojibake_sequence(text)

# 確認
mojibake_count = sum(1 for ch in fixed if 0x80 <= ord(ch) <= 0xFF)
print(f'Remaining latin-1 chars after fix: {mojibake_count}')

# サンプル確認
lines = fixed.split('\n')
for i, line in enumerate(lines[118:135], 119):
    print(f'{i}: {line[:80]}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(fixed)
print('Done')
