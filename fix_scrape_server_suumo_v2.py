# -*- coding: utf-8 -*-
"""
mainブランチのscrape_server.pyにSUUMO対応を追加する
- scrape_athome() は一切変更しない
- scrape_suumo() という新しい関数を追加する
- do_POST() でURLに応じて分岐するだけ
"""

with open('scrape-server/scrape_server.py', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 変更1: scrape_suumo() 関数を scrape_athome() の直前に追加 =====
suumo_function = r'''
async def scrape_suumo(url: str) -> dict:
    """
    SUUMOの物件ページをスクレイピングする関数。
    scrape_athome() とは完全に独立しており、既存機能に影響しない。
    福岡建売専門HP用に追加（2026-05-09）。
    """
    from playwright.async_api import async_playwright
    from playwright_stealth import Stealth
    from bs4 import BeautifulSoup

    parsed = urlparse(url)
    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if not clean_url.endswith('/'):
        clean_url += '/'

    result = {
        'source_url': url,
        'title': None, 'price': None, 'address': None, 'access': None,
        'layout': None, 'area': None, 'floor': None, 'built_year': None,
        'parking': None, 'features': None, 'remarks': None,
        'images': [], 'lat': None, 'lng': None, 'details': {}, 'points': [],
        'appeal_comment': None,
    }

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='ja-JP',
        )
        page = await context.new_page()

        print(f'[suumo] アクセス中: {clean_url}')
        await page.goto(clean_url, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(5000)

        # ページを下までスクロールして全コンテンツ・画像を読み込む
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
        await page.wait_for_timeout(3000)
        await page.evaluate('window.scrollTo(0, 0)')
        await page.wait_for_timeout(1000)

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # --- タイトル ---
        title_tag = soup.find('title')
        if title_tag:
            t = title_tag.get_text(strip=True)
            t = re.sub(r'【[^】]+】', '', t)
            t = re.sub(r'\s*[-|｜].*$', '', t).strip()
            result['title'] = t

        # --- 物件概要テーブルから各フィールドを抽出 ---
        details = {}
        for table in soup.find_all('table'):
            for row in table.find_all('tr'):
                th = row.find('th')
                td = row.find('td')
                if th and td:
                    k = th.get_text(strip=True).replace('ヒント', '').strip()
                    v = td.get_text(separator=' ', strip=True)
                    v = re.sub(r'\[.*?\]', '', v).strip()
                    if k and v and v not in ('-', '－'):
                        details[k] = v
        result['details'] = details

        # フィールドマッピング
        field_map = {
            'price':      ['価格'],
            'address':    ['所在地'],
            'access':     ['交通'],
            'layout':     ['間取り'],
            'area':       ['建物面積'],
            'floor':      ['構造・工法'],
            'built_year': ['完成時期(築年月)', '完成時期（築年月）'],
            'parking':    ['駐車場'],
        }
        for field, keys in field_map.items():
            for k in keys:
                if k in details and details[k]:
                    val = details[k]
                    if field == 'price':
                        val = re.sub(r'支払.*$', '', val).strip()
                    elif field == 'access':
                        val = re.sub(r'乗り換え案内.*$', '', val).strip()
                        if len(val) > 80:
                            val = val[:80] + '...'
                    elif field == 'area':
                        val = val.replace(' ', '')
                        m = re.match(r'[\d.]+m2', val)
                        if m:
                            val = m.group(0)
                    elif field == 'layout':
                        m = re.search(r'[1-9][SLDK+]+', val)
                        if m:
                            val = m.group(0)
                    result[field] = val
                    break

        # --- 画像取得（Playwrightで実際に読み込まれた画像を取得） ---
        images = []
        seen = set()

        # img要素のsrc属性から取得（img.suumo.comドメイン）
        img_elements = await page.query_selector_all('img[src*="img.suumo.com"]')
        for img in img_elements:
            src = await img.get_attribute('src')
            if src and src not in seen:
                if any(x in src for x in ['logo', 'icon', 'btn', 'arrow', 'blank', 'noimage']):
                    continue
                seen.add(src)
                images.append(src)

        # data-src属性（遅延ロード）
        if len(images) < 3:
            lazy_imgs = await page.query_selector_all('img[data-src*="img.suumo.com"]')
            for img in lazy_imgs:
                src = await img.get_attribute('data-src')
                if src and src not in seen:
                    if any(x in src for x in ['logo', 'icon', 'btn', 'arrow', 'blank', 'noimage']):
                        continue
                    seen.add(src)
                    images.append(src)

        result['images'] = images[:20]
        print(f'[suumo] 画像: {len(images)}枚')

        # --- 緯度経度（日本全国対応） ---
        lat_candidates = list(set(re.findall(r'\b([23][0-9]\.[0-9]{6,})\b', html)))
        lng_candidates = list(set(re.findall(r'\b(1[2-4][0-9]\.[0-9]{6,})\b', html)))
        lat_sorted = sorted(lat_candidates, key=lambda x: len(x.split('.')[1]))
        lng_sorted = sorted(lng_candidates, key=lambda x: len(x.split('.')[1]))
        if lat_sorted:
            result['lat'] = float(lat_sorted[0])
        if lng_sorted:
            result['lng'] = float(lng_sorted[0])
        print(f'[suumo] lat={result["lat"]}, lng={result["lng"]}')

        await browser.close()

    return result


'''

# scrape_athome() の直前に挿入
target = 'async def scrape_athome(url: str) -> dict:'
if target in text:
    text = text.replace(target, suumo_function + target, 1)
    print('✅ scrape_suumo() 関数を追加しました')
else:
    print('❌ scrape_athome() が見つかりません')
    exit(1)

# ===== 変更2: do_POST() でURLに応じて分岐 =====
old_call = '            # スクレイピング実行\n            data = asyncio.run(scrape_athome(url))'
new_call = '''            # スクレイピング実行（URLに応じて関数を切り替え）
            # SUUMOのURLは scrape_suumo() を使用、それ以外は既存の scrape_athome() を使用
            if 'suumo.jp' in url:
                data = asyncio.run(scrape_suumo(url))
            else:
                data = asyncio.run(scrape_athome(url))'''

if old_call in text:
    text = text.replace(old_call, new_call, 1)
    print('✅ do_POST() の分岐を追加しました')
else:
    print('❌ do_POST() の対象行が見つかりません、別パターンを試します')
    old_call2 = '            data = asyncio.run(scrape_athome(url))'
    if old_call2 in text:
        new_call2 = '''            # URLに応じてスクレイピング関数を切り替え
            if 'suumo.jp' in url:
                data = asyncio.run(scrape_suumo(url))
            else:
                data = asyncio.run(scrape_athome(url))'''
        text = text.replace(old_call2, new_call2, 1)
        print('✅ do_POST() の分岐を追加しました（パターン2）')
    else:
        print('❌ パターン2も見つかりません')
        exit(1)

# UTF-8で書き込む（BOMなし）
with open('scrape-server/scrape_server.py', 'wb') as f:
    f.write(text.encode('utf-8'))

# 確認
with open('scrape-server/scrape_server.py', 'rb') as f:
    check = f.read().decode('utf-8')
print(f'scrape_suumo 含まれる: {"scrape_suumo" in check}')
print(f'suumo.jp 含まれる: {"suumo.jp" in check}')
print(f'scrape_athome 含まれる: {"scrape_athome" in check}')
print('✅ 完了！')
