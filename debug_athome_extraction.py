# -*- coding: utf-8 -*-
"""
athomeのHTMLを取得して、ポイントテキストと座標の抽出をデバッグする
"""

import asyncio
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup

async def debug_athome(url: str):
    """athomeページをスクレイピングしてデバッグ情報を出力"""
    
    # URLからクリーンなベースURLを取得
    from urllib.parse import urlparse
    parsed = urlparse(url)
    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if not clean_url.endswith('/'):
        clean_url += '/'

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='ja-JP',
        )
        page = await context.new_page()

        print(f'[DEBUG] アクセス中: {clean_url}')
        await page.goto(clean_url, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(3000)

        # スクロールして遅延読み込み画像を取得
        await page.evaluate("""
            async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 300;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            }
        """)
        await page.wait_for_timeout(2000)
        await page.evaluate('window.scrollTo(0, 0)')
        await page.wait_for_timeout(500)

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        print('\n' + '='*80)
        print('【座標の抽出デバッグ】')
        print('='*80)
        
        # 座標抽出（改善版）
        lat_lng_match = re.search(r'center=([0-9.]+),([0-9.]+)', html)
        if lat_lng_match:
            lat = float(lat_lng_match.group(1))
            lng = float(lat_lng_match.group(2))
            print(f'✅ center=パラメータから抽出: lat={lat}, lng={lng}')
        else:
            print('❌ center=パラメータが見つかりませんでした')
            
            # フォールバック：HTMLから数値パターンで抽出
            lat_candidates = re.findall(r'\b(3[0-9]|4[0-5])\.\d{6,}\b', html)
            lng_candidates = re.findall(r'\b(12[0-9]|13[0-9]|14[0-9])\.\d{6,}\b', html)
            
            print(f'   緯度候補: {lat_candidates[:5]}')
            print(f'   経度候補: {lng_candidates[:5]}')
            
            if lat_candidates:
                lat_candidates = list(set(lat_candidates))
                lat_candidates.sort(key=lambda x: len(x.split('.')[1]) if '.' in x else 0, reverse=True)
                lat = float(lat_candidates[0])
                print(f'   → 緯度: {lat}')
            
            if lng_candidates:
                lng_candidates = list(set(lng_candidates))
                lng_candidates.sort(key=lambda x: len(x.split('.')[1]) if '.' in x else 0, reverse=True)
                lng = float(lng_candidates[0])
                print(f'   → 経度: {lng}')

        print('\n' + '='*80)
        print('【ポイントテキストの抽出デバッグ】')
        print('='*80)
        
        # 「ポイント」または「設備・仕様・構造」セクションを取得
        points = []
        point_section = soup.find('h2', string=re.compile(r'(ポイント|設備・仕様・構造)'))
        
        if point_section:
            print(f'✅ セクション見つかりました: {point_section.get_text(strip=True)}')
            
            # ポイントセクションの次の要素から情報を取得
            next_elem = point_section.find_next_sibling()
            elem_count = 0
            while next_elem and elem_count < 20:  # 最大20要素まで
                elem_count += 1
                print(f'\n--- 要素 {elem_count}: {next_elem.name} ---')
                
                if next_elem.name == 'ul':
                    print('   タイプ: ul（リスト）')
                    for li in next_elem.find_all('li'):
                        text = li.get_text(strip=True)
                        if text and len(text) > 2:
                            points.append(text)
                            print(f'   ✓ {text[:50]}...')
                
                elif next_elem.name == 'div':
                    print('   タイプ: div')
                    # div内の<p class="point-text">を明示的に取得
                    point_texts = next_elem.find_all('p', class_='point-text')
                    if point_texts:
                        print(f'   ✅ point-textクラスのp要素: {len(point_texts)}個')
                        for p in point_texts:
                            text = p.get_text(strip=True)
                            if text and len(text) > 2:
                                points.append(text)
                                print(f'   ✓ {text[:50]}...')
                    else:
                        print('   ⚠️ point-textクラスのp要素が見つかりません')
                        # div内の全てのp要素を確認
                        all_p = next_elem.find_all('p')
                        if all_p:
                            print(f'   📝 div内のp要素: {len(all_p)}個')
                            for p in all_p:
                                classes = p.get('class', [])
                                text = p.get_text(strip=True)[:50]
                                print(f'      - class={classes}, text={text}...')
                        
                        # 通常のテキスト取得
                        text = next_elem.get_text(strip=True)
                        if text and len(text) > 5:
                            lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 5]
                            points.extend(lines)
                            print(f'   ✓ テキスト分割: {len(lines)}行')
                
                elif next_elem.name == 'p':
                    print('   タイプ: p')
                    text = next_elem.get_text(strip=True)
                    if text and len(text) > 2:
                        points.append(text)
                        print(f'   ✓ {text[:50]}...')
                
                elif next_elem.name == 'h2':
                    print('   タイプ: h2（次のセクション）→ 終了')
                    break
                
                next_elem = next_elem.find_next_sibling()
        else:
            print('❌ 「ポイント」または「設備・仕様・構造」セクションが見つかりませんでした')
            
            # セクション外のpoint-textクラスを探す
            all_point_texts = soup.find_all('p', class_='point-text')
            if all_point_texts:
                print(f'⚠️ セクション外にpoint-textクラスのp要素: {len(all_point_texts)}個')
                for p in all_point_texts:
                    text = p.get_text(strip=True)
                    if text and len(text) > 2:
                        points.append(text)
                        print(f'   ✓ {text[:50]}...')
        
        print('\n' + '='*80)
        print(f'【結果】')
        print('='*80)
        print(f'ポイント数: {len(points)}項目')
        for i, point in enumerate(points[:10], 1):  # 最初の10項目のみ表示
            print(f'{i}. {point[:100]}...')
        
        if len(points) > 10:
            print(f'... 他 {len(points) - 10}項目')

        await browser.close()

if __name__ == '__main__':
    # テスト用URL（ユーザーが使用しているURL）
    test_url = input('athomeのURLを入力してください: ').strip()
    if test_url:
        asyncio.run(debug_athome(test_url))
    else:
        print('URLが入力されませんでした')
