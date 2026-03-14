"""
BuyerDetailPage.tsx の文字化けを修正。
文字化けパターン: Shift-JISのバイト列をCP1252(Windows-1252)として読んでUTF-8保存したもの。
各文字をCP1252バイトに戻してShift-JISとして再デコードする。
"""

def try_decode_as_shiftjis(chars):
    """文字列をCP1252バイト列に変換してShift-JISとしてデコード試行"""
    try:
        raw = ''.join(chars).encode('cp1252')
        return raw.decode('shift_jis')
    except Exception:
        return None

def fix_line(line):
    """1行の文字化けを修正"""
    # 文字化けしている可能性のある文字の範囲
    # Shift-JISの2バイト文字がCP1252/latin-1として誤解釈されたもの
    MOJIBAKE_RANGES = [
        (0x80, 0xFF),   # latin-1/CP1252範囲
        (0xFF61, 0xFF9F), # 半角カタカナ
        # Shift-JISがUTF-8として誤解釈された文字
        (0x7E00, 0x7FFF),
        (0x8000, 0x8FFF),
    ]
    
    def is_mojibake(ch):
        code = ord(ch)
        # よく見られる文字化けパターン
        mojibake_chars = set('繝縺繧蜿蝠蟶謖莉鬧蛻蝓雋豌髮蜀蠕邨蜷逡蜉蜈螳蟾蜒蜑蜊蜋蜌蜍蜎蜏蜐蜑蜒蜓蜔蜕蜖蜗蜘蜙蜚蜛蜜蜝蜞蜟蜠蜡蜢蜣蜤蜥蜦蜧蜨蜩蜪蜫蜬蜭蜮蜯蜰蜱蜲蜳蜴蜵蜶蜷蜸蜹蜺蜻蜼蜽蜾蜿蝀蝁蝂蝃蝄蝅蝆蝇蝈蝉蝊蝋蝌蝍蝎蝏蝐蝑蝒蝓蝔蝕蝖蝗蝘蝙蝚蝛蝜蝝蝞蝟蝠蝡蝢蝣蝤蝥蝦蝧蝨蝩蝪蝫蝬蝭蝮蝯蝰蝱蝲蝳蝴蝵蝶蝷蝸蝹蝺蝻蝼蝽蝾蝿螀螁螂螃螄螅螆螇螈螉螊螋螌融螎螏螐螑螒螓螔螕螖螗螘螙螚螛螜螝螞螟螠螡螢螣螤螥螦螧螨螩螪螫螬螭螮螯螰螱螲螳螴螵螶螷螸螹螺螻螼螽螾螿蟀蟁蟂蟃蟄蟅蟆蟇蟈蟉蟊蟋蟌蟍蟎蟏蟐蟑蟒蟓蟔蟕蟖蟗蟘蟙蟚蟛蟜蟝蟞蟟蟠蟡蟢蟣蟤蟥蟦蟧蟨蟩蟪蟫蟬蟭蟮蟯蟰蟱蟲蟳蟴蟵蟶蟷蟸蟹蟺蟻蟼蟽蟾蟿蠀蠁蠂蠃蠄蠅蠆蠇蠈蠉蠊蠋蠌蠍蠎蠏蠐蠑蠒蠓蠔蠕蠖蠗蠘蠙蠚蠛蠜蠝蠞蠟蠠蠡蠢蠣蠤蠥蠦蠧蠨蠩蠪蠫蠬蠭蠮蠯蠰蠱蠲蠳蠴蠵蠶蠷蠸蠹蠺蠻蠼蠽蠾蠿')
        return ch in mojibake_chars or (0x80 <= code <= 0xFF)
    
    result = []
    i = 0
    while i < len(line):
        ch = line[i]
        if is_mojibake(ch):
            # 連続する文字化け文字を収集
            seq = [ch]
            j = i + 1
            while j < len(line) and is_mojibake(line[j]):
                seq.append(line[j])
                j += 1
            
            # CP1252としてエンコードしてShift-JISとしてデコード
            decoded = try_decode_as_shiftjis(seq)
            if decoded:
                result.append(decoded)
            else:
                # 2文字ずつ試す
                k = 0
                while k < len(seq):
                    if k + 1 < len(seq):
                        decoded2 = try_decode_as_shiftjis(seq[k:k+2])
                        if decoded2:
                            result.append(decoded2)
                            k += 2
                            continue
                    result.append(seq[k])
                    k += 1
            i = j
        else:
            result.append(ch)
            i += 1
    
    return ''.join(result)


with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
fixed_lines = [fix_line(line) for line in lines]
fixed = '\n'.join(fixed_lines)

# 確認
mojibake_count = sum(1 for ch in fixed if ord(ch) > 0x7F and not (0x3000 <= ord(ch) <= 0x9FFF) and not (0xFF00 <= ord(ch) <= 0xFFFF))
print(f'Remaining non-ASCII non-CJK chars: {mojibake_count}')

# サンプル確認
result_lines = fixed.split('\n')
print('\nSample lines 127-160:')
for i, line in enumerate(result_lines[126:160], 127):
    print(f'{i}: {line[:100]}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(fixed)
print('\nDone')
