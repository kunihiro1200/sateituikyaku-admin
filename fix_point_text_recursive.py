# -*- coding: utf-8 -*-
"""
point-text取得を再帰的に検索するように修正
"""

# Railwayリポジトリのscrape_server.pyを読み込む
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 現在のdiv内のロジックを修正
old_logic = '''                elif next_elem.name == 'div':
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

new_logic = '''                elif next_elem.name == 'div':
                    # div内の<p class="point-text">を再帰的に取得
                    point_texts = next_elem.find_all('p', class_=lambda x: x and 'point-text' in x)
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

if old_logic in text:
    text = text.replace(old_logic, new_logic)
    print('✅ point-text取得を再帰的検索に変更しました')
else:
    print('❌ 対象のコードが見つかりませんでした')

# セクション外のpoint-text取得も同様に修正
old_all_point = "all_point_texts = soup.find_all('p', class_='point-text')"
new_all_point = "all_point_texts = soup.find_all('p', class_=lambda x: x and 'point-text' in x)"

if old_all_point in text:
    text = text.replace(old_all_point, new_all_point)
    print('✅ セクション外のpoint-text取得も修正しました')
else:
    print('⚠️ セクション外のpoint-text取得は既に修正済みまたは見つかりませんでした')

# UTF-8で書き込む
with open('C:\\Users\\kunih\\sateituikyaku-scrape-server\\scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
