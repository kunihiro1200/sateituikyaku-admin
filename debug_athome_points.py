# -*- coding: utf-8 -*-
"""
アットホームの「ポイント」セクションのHTML構造を調査
"""

import asyncio
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup

async def debug_points():
    url = "https://www.athome.co.jp/kodate/3920695202/"
    
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='ja-JP',
        )
        page = await context.new_page()

        print(f'アクセス中: {url}')
        await page.goto(url, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(3000)

        # スクロール
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

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # 「ポイント」または「設備・仕様・構造」セクションを探す
        print('\n=== セクションの検索 ===')
        
        # h2タグを全て確認
        h2_tags = soup.find_all('h2')
        print(f'h2タグ: {len(h2_tags)}個')
        for h2 in h2_tags:
            print(f'  - {h2.get_text(strip=True)}')
        
        # 「設備・仕様・構造」セクションを詳しく調査
        equipment_section = soup.find('h2', string=re.compile(r'設備・仕様・構造'))
        if equipment_section:
            print('\n=== 「設備・仕様・構造」セクションの詳細 ===')
            print(f'見出し: {equipment_section.get_text(strip=True)}')
            
            # 次の要素を10個まで確認
            current = equipment_section.find_next_sibling()
            count = 0
            while current and count < 15:
                print(f'\n--- 要素 {count+1} ---')
                print(f'タグ: {current.name}')
                print(f'クラス: {current.get("class")}')
                
                # テキスト内容
                text = current.get_text(strip=True)
                if text:
                    print(f'テキスト長: {len(text)}文字')
                    print(f'テキスト: {text[:300]}...')
                
                # 画像があるか確認
                imgs = current.find_all('img')
                if imgs:
                    print(f'画像: {len(imgs)}枚')
                    for img in imgs[:3]:
                        src = img.get('src', '')
                        alt = img.get('alt', '')
                        print(f'  - src: {src[:80]}...')
                        print(f'    alt: {alt}')
                
                # 次のh2に到達したら終了
                if current.name == 'h2':
                    print('  → 次のセクションに到達')
                    break
                
                current = current.find_next_sibling()
                count += 1

        # 座標を確認
        print('\n=== 座標の確認 ===')
        lats = list(set(re.findall(r'3[0-9]\.\d{5,}', html)))
        lngs = list(set(re.findall(r'13[0-9]\.\d{5,}', html)))
        print(f'緯度候補: {lats}')
        print(f'経度候補: {lngs}')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(debug_points())
