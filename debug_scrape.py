# -*- coding: utf-8 -*-
"""
デバッグ用スクレイピングスクリプト
"""

import asyncio
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup

async def debug_scrape():
    url = "https://www.athome.co.jp/kodate/3920695202/"
    
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
        await page.evaluate('window.scrollTo(0, 0)')
        await page.wait_for_timeout(500)

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # 画像を確認
        print('\n=== 画像確認 ===')
        slide_imgs = await page.query_selector_all("[class*='slide'] img")
        print(f'スライダー画像: {len(slide_imgs)}枚')
        for i, img in enumerate(slide_imgs[:5]):
            src = await img.get_attribute('src')
            print(f'  {i+1}. {src}')

        all_imgs = await page.query_selector_all('img')
        print(f'\n全画像: {len(all_imgs)}枚')
        image_files_count = 0
        for img in all_imgs:
            src = await img.get_attribute('src')
            if src and 'image_files/path' in src:
                image_files_count += 1
                if image_files_count <= 5:
                    print(f'  {image_files_count}. {src}')

        # ポイント/設備・仕様・構造セクションを確認
        print('\n=== ポイント/設備・仕様・構造セクション確認 ===')
        point_section = soup.find('h2', string=re.compile(r'(ポイント|設備・仕様・構造)'))
        if point_section:
            print(f'セクション見つかりました: {point_section.get_text(strip=True)}')
            print(f'タグ: {point_section.name}')
            
            next_elem = point_section.find_next_sibling()
            count = 0
            while next_elem and count < 10:
                print(f'\n次の要素 {count+1}:')
                print(f'  タグ: {next_elem.name}')
                print(f'  クラス: {next_elem.get("class")}')
                text = next_elem.get_text(strip=True)
                print(f'  テキスト長: {len(text)}文字')
                print(f'  テキスト: {text[:200]}...')
                
                if next_elem.name == 'h2':
                    print('  → 次のセクションに到達')
                    break
                
                next_elem = next_elem.find_next_sibling()
                count += 1
        else:
            print('ポイント/設備・仕様・構造セクションが見つかりません')

        # 物件概要セクションを確認
        print('\n=== 物件概要セクション確認 ===')
        overview_section = soup.find('h2', string=re.compile(r'物件概要'))
        if overview_section:
            print('物件概要セクション見つかりました')
        else:
            print('物件概要セクションが見つかりません')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(debug_scrape())
