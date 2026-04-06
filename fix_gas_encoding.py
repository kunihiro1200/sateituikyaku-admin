# -*- coding: utf-8 -*-
import sys

# UTF-8で読み込み
try:
    with open('gas_buyer_complete_code.js', 'rb') as f:
        content = f.read()
    
    # Shift-JISとして読み込んでUTF-8に変換
    try:
        text = content.decode('shift-jis')
        print('✅ Shift-JISとして読み込み成功')
    except:
        try:
            text = content.decode('utf-8')
            print('✅ UTF-8として読み込み成功')
        except:
            print('❌ エンコーディング判定失敗')
            sys.exit(1)
    
    # 777行目から972行目を削除
    lines = text.split('\n')
    print(f'📊 元の行数: {len(lines)}')
    
    # 777行目から972行目を削除（0-indexedなので776から971）
    if len(lines) >= 972:
        del lines[776:972]
        print(f'✅ 777-972行目を削除しました')
        print(f'📊 削除後の行数: {len(lines)}')
    else:
        print(f'⚠️ ファイルが972行未満です（{len(lines)}行）')
    
    # UTF-8で書き込み（BOMなし）
    result = '\n'.join(lines)
    with open('gas_buyer_complete_code.js', 'wb') as f:
        f.write(result.encode('utf-8'))
    
    print('✅ UTF-8で保存完了')
    
    # 確認
    with open('gas_buyer_complete_code.js', 'rb') as f:
        check = f.read()
    
    if check[:3] == b'\xef\xbb\xbf':
        print('⚠️ BOM付きUTF-8です')
    else:
        print('✅ BOMなしUTF-8です')
    
    # 最後の20行を表示
    final_lines = result.split('\n')
    print('\n📄 最後の20行:')
    for line in final_lines[-20:]:
        print(line)

except Exception as e:
    print(f'❌ エラー: {e}')
    import traceback
    traceback.print_exc()
