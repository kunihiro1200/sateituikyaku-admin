# -*- coding: utf-8 -*-

# コードを読み込み
with open('gas_buyer_complete_code_from_user.txt', 'w', encoding='utf-8') as f:
    # ユーザーから提供されたコードを保存（改行を復元）
    code = """// ここにユーザーのコードを貼り付け"""
    f.write(code)

# 実際の処理
code = """ここにユーザーのコードを貼り付け"""

# 関数の出現回数を確認
count = code.count('function updateBuyerSidebarCounts_() {')
print(f'updateBuyerSidebarCounts_関数の出現回数: {count}')

# 2つ目の出現位置を見つける
first_pos = code.find('function updateBuyerSidebarCounts_() {')
second_pos = code.find('function updateBuyerSidebarCounts_() {', first_pos + 1)

if second_pos != -1:
    print(f'1つ目の位置: {first_pos}')
    print(f'2つ目の位置: {second_pos}')
    
    # 2つ目の関数の開始位置を特定
    # その前のコメント行も含めて削除
    lines = code[:second_pos].split('\n')
    
    # 2つ目の関数の直前のコメント行を探す
    comment_start = second_pos
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if line.startswith('//'):
            # コメント行の開始位置を計算
            comment_start = len('\n'.join(lines[:i])) + (1 if i > 0 else 0)
        else:
            break
    
    # 2つ目の関数とそのコメントを削除
    result = code[:comment_start]
    
    print(f'\n削除後の文字数: {len(result)}')
    print(f'削除した文字数: {len(code) - len(result)}')
    
    # 保存
    with open('gas_buyer_complete_code.js', 'w', encoding='utf-8', newline='\n') as f:
        f.write(result)
    
    print('\n✅ 2つ目のupdateBuyerSidebarCounts_関数を削除しました')
    
    # 確認
    final_count = result.count('function updateBuyerSidebarCounts_() {')
    print(f'削除後の関数出現回数: {final_count}')
else:
    print('2つ目の関数が見つかりませんでした')
