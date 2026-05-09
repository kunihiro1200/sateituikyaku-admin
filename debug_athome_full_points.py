# -*- coding: utf-8 -*-
"""
アットホームの「ポイント」セクションの完全な内容を取得
"""

import asyncio
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup

async def debug_full_points():
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

        # 「制震構造」「制震ユニット」などのキーワードを検索
        print('\n=== キーワード検索 ===')
        keywords = ['制震構造', 'ミライエ', 'MIRAIE', '熊本城', '制震ユニット', '耐震等級']
        
        for keyword in keywords:
            elements = soup.find_all(string=re.compile(keyword))
            if elements:
                print(f'\n「{keyword}」を含む要素: {len(elements)}個')
                for i, elem in enumerate(elements[:2]):
                    print(f'\n--- {i+1}個目 ---')
                    parent = elem.parent
                    print(f'親要素: {parent.name}')
                    print(f'クラス: {parent.get("class")}')
                    # 親要素の全テキストを取得
                    text = parent.get_text(strip=True)
                    print(f'テキスト: {text[:300]}...')
                    
                    # さらに親要素を確認
                    grandparent = parent.parent
                    if grandparent:
                        print(f'祖父母要素: {grandparent.name}')
                        print(f'クラス: {grandparent.get("class")}')

        # 全てのdivを確認して、長いテキストを含むものを探す
        print('\n\n=== 長いテキストを含むdiv要素 ===')
        divs = soup.find_all('div')
        long_text_divs = []
        for div in divs:
            text = div.get_text(strip=True)
            if len(text) > 100 and '制震' in text:
                long_text_divs.append((div, text))
        
        print(f'長いテキストを含むdiv: {len(long_text_divs)}個')
        for i, (div, text) in enumerate(long_text_divs[:3]):
            print(f'\n--- div {i+1} ---')
            print(f'クラス: {div.get("class")}')
            print(f'テキスト長: {len(text)}文字')
            print(f'テキスト: {text[:500]}...')

        # 画像のalt属性とtitle属性を確認
        print('\n\n=== 画像のalt/title属性 ===')
        imgs = soup.find_all('img')
        print(f'画像: {len(imgs)}枚')
        
        for i, img in enumerate(imgs[:20]):
            src = img.get('src', '')
            alt = img.get('alt', '')
            title = img.get('title', '')
            
            if alt or title:
                print(f'\n--- 画像 {i+1} ---')
                print(f'src: {src[:80]}...')
                if alt:
                    print(f'alt: {alt}')
                if title:
                    print(f'title: {title}')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(debug_full_points())
