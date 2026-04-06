# -*- coding: utf-8 -*-
import sys
import re

# UTF-8で読み込み
try:
    with open('gas_buyer_complete_code.js', 'rb') as f:
        content = f.read()
    
    text = content.decode('utf-8')
    print('✅ UTF-8として読み込み成功')
    
    # 改行を正規化（\r\nを\nに統一）
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # 777行目から972行目を削除
    lines = text.split('\n')
    print(f'📊 元の行数: {len(lines)}')
    
    # 777行目から972行目を削除（0-indexedなので776から971）
    if len(lines) >= 972:
        # 削除する範囲を確認
        print(f'\n🔍 削除する範囲の最初の行（777行目）:')
        print(lines[776][:100])
        print(f'\n🔍 削除する範囲の最後の行（972行目）:')
        print(lines[971][:100])
        
        del lines[776:972]
        print(f'\n✅ 777-972行目を削除しました')
        print(f'📊 削除後の行数: {len(lines)}')
    else:
        print(f'⚠️ ファイルが972行未満です（{len(lines)}行）')
    
    # UTF-8で書き込み（BOMなし、改行は\n）
    result = '\n'.join(lines)
    with open('gas_buyer_complete_code.js', 'wb') as f:
        f.write(result.encode('utf-8'))
    
    print('\n✅ UTF-8で保存完了')
    
    # 確認
    with open('gas_buyer_complete_code.js', 'rb') as f:
        check = f.read()
    
    if check[:3] == b'\xef\xbb\xbf':
        print('⚠️ BOM付きUTF-8です')
    else:
        print('✅ BOMなしUTF-8です')
    
    # 最後の30行を表示
    final_lines = result.split('\n')
    print('\n📄 最後の30行:')
    for i, line in enumerate(final_lines[-30:], start=len(final_lines)-29):
        print(f'{i:4d}: {line}')
    
    # updateBuyerSidebarCounts_関数の出現回数を確認
    count = text.count('function updateBuyerSidebarCounts_')
    print(f'\n🔍 updateBuyerSidebarCounts_関数の出現回数: {count}')

except Exception as e:
    print(f'❌ エラー: {e}')
    import traceback
    traceback.print_exc()
