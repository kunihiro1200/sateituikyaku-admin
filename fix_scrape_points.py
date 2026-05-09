# -*- coding: utf-8 -*-
"""
scrape_server.pyのポイント取得ロジックを修正
<p class="point-text">要素を明示的に取得するように変更
"""

with open('scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 古いポイント取得ロジックを新しいロジックに置き換え
old_code = '''        # 「ポイント」または「設備・仕様・構造」セクションを取得
        points = []
        point_section = soup.find('h2', string=re.compile(r'(ポイント|設備・仕様・構造)'))
        if point_section:
            # ポイントセクションの次の要素から情報を取得
            next_elem = point_section.find_next_sibling()
            while next_elem:
                if next_elem.name == 'ul':
                    for li in next_elem.find_all('li'):
                        text = li.get_text(strip=True)
                        if text and len(text) > 2:  # 2文字以上
                            points.append(text)
                elif next_elem.name == 'div':
                    # div内のテキストを取得
                    text = next_elem.get_text(strip=True)
                    if text and len(text) > 5:  # 5文字以上
                        # 改行で分割して複数のポイントとして扱う
                        lines = [line.strip() for line in text.split('\\n') if line.strip() and len(line.strip()) > 5]
                        points.extend(lines)
                elif next_elem.name == 'p':
                    # p内のテキストを取得（タイトルなど）
                    text = next_elem.get_text(strip=True)
                    if text and len(text) > 2:
                        points.append(text)
                elif next_elem.name == 'h2':
                    # 次のセクションに到達したら終了
                    break
                next_elem = next_elem.find_next_sibling()
        
        result['points'] = points
        print(f'[scrape] ポイント: {len(points)}項目')'''

new_code = '''        # 「ポイント」または「設備・仕様・構造」セクションを取得
        points = []
        point_section = soup.find('h2', string=re.compile(r'(ポイント|設備・仕様・構造)'))
        if point_section:
            # ポイントセクションの次の要素から情報を取得
            next_elem = point_section.find_next_sibling()
            while next_elem:
                if next_elem.name == 'ul':
                    for li in next_elem.find_all('li'):
                        text = li.get_text(strip=True)
                        if text and len(text) > 2:  # 2文字以上
                            points.append(text)
                elif next_elem.name == 'div':
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
                            points.extend(lines)
                elif next_elem.name == 'p':
                    # p内のテキストを取得（タイトルなど）
                    text = next_elem.get_text(strip=True)
                    if text and len(text) > 2:
                        points.append(text)
                elif next_elem.name == 'h2':
                    # 次のセクションに到達したら終了
                    break
                next_elem = next_elem.find_next_sibling()
        
        # point-textクラスを持つ全てのp要素を取得（セクション外にある場合も対応）
        all_point_texts = soup.find_all('p', class_='point-text')
        for p in all_point_texts:
            text = p.get_text(strip=True)
            if text and len(text) > 2 and text not in points:
                points.append(text)
        
        result['points'] = points
        print(f'[scrape] ポイント: {len(points)}項目')'''

text = text.replace(old_code, new_code)

# UTF-8で書き込む（BOMなし）
with open('scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ scrape_server.py を修正しました')
print('変更内容:')
print('- div内の<p class="point-text">要素を明示的に取得')
print('- ページ全体から<p class="point-text">要素を検索')
