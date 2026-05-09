# -*- coding: utf-8 -*-
"""
scrape_server.pyにpoint-text取得ロジックを追加する
"""

import re

# Railwayリポジトリのscrape_server.pyを読み込む
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ポイント取得のロジックを探す
# 「elif next_elem.name == 'div':」の部分を見つけて、point-text取得ロジックを追加

old_div_logic = '''                elif next_elem.name == 'div':
                    text = next_elem.get_text(strip=True)
                    if text and len(text) > 5:  # 5文字以上
                        # 改行で分割して複数のポイントとして扱う
                        lines = [line.strip() for line in text.split('\\n') if line.strip() and len(line.strip()) > 5]
                        points.extend(lines)'''

new_div_logic = '''                elif next_elem.name == 'div':
                    # div内の<p class="point-text">を明示的に取得
                    point_texts = next_elem.find_all('p', class_='point-text')
                    if point_texts:
                        for p in point_texts:
                            text = p.get_text(strip=True)
                            if text and len(text) > 2:
                                points.append(text)
                    else:
                        # point-textクラスがない場合は通常のテキスト取得
                        text = next_elem.get_text(strip=True)
                        if text and len(text) > 5:  # 5文字以上
                            # 改行で分割して複数のポイントとして扱う
                            lines = [line.strip() for line in text.split('\\n') if line.strip() and len(line.strip()) > 5]
                            points.extend(lines)'''

if old_div_logic in text:
    text = text.replace(old_div_logic, new_div_logic)
    print('✅ point-text取得ロジックを追加しました')
else:
    print('❌ 対象のコードが見つかりませんでした')
    print('手動で確認してください')

# セクション外のpoint-textも取得するロジックを追加
# 「result['points'] = points」の前に追加

old_result_line = "        result['points'] = points"
new_logic = '''        
        # point-textクラスを持つ全てのp要素を取得（セクション外にある場合も対応）
        all_point_texts = soup.find_all('p', class_='point-text')
        for p in all_point_texts:
            text = p.get_text(strip=True)
            if text and len(text) > 2 and text not in points:
                points.append(text)
        
        result['points'] = points'''

if old_result_line in text:
    text = text.replace(old_result_line, new_logic)
    print('✅ セクション外のpoint-text取得ロジックを追加しました')
else:
    print('❌ result[\'points\']が見つかりませんでした')

# UTF-8で書き込む
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
