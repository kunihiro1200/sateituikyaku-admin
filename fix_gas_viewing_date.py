#!/usr/bin/env python3
"""
GASコードのlatest_viewing_dateをviewing_dateに修正
"""

files_to_fix = [
    'gas_buyer_complete_code.js',
]

for filepath in files_to_fix:
    with open(filepath, 'rb') as f:
        content = f.read()
    
    text = content.decode('utf-8')
    
    # latest_viewing_dateをviewing_dateに置換
    original_text = text
    text = text.replace('latest_viewing_date', 'viewing_date')
    text = text.replace('LatestViewingDate', 'ViewingDate')
    
    if text != original_text:
        # UTF-8で書き込む（BOMなし）
        with open(filepath, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'✅ {filepath} を修正しました')
    else:
        print(f'   {filepath} は変更不要でした')

print('\n✅ 全てのGASファイルを修正しました')
