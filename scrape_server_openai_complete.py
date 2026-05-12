# -*- coding: utf-8 -*-
"""
ローカルスクレイピングAPIサーバー
フロントエンドからのリクエストを受けてathomeをスクレイピングし結果を返す
起動方法: python scrape_server.py
"""

import asyncio
import json
import re
import uuid
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# OpenAI画像処理をインポート
from openai_image_processor import process_images_with_openai

# Supabase接続情報（環境変数から読み込み）
def load_env():
    env = {}
    # まず環境変数から読み込む（Railway用）
    if os.environ.get('SUPABASE_URL'):
        env['SUPABASE_URL'] = os.environ.get('SUPABASE_URL')
        env['SUPABASE_SERVICE_KEY'] = os.environ.get('SUPABASE_SERVICE_KEY', '')
        return env
    # 環境変数がない場合は.envファイルから読み込む（ローカル開発用）
    env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
    try:
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip()
    except Exception as e:
        print(f'Warning: Could not load .env: {e}')
    return env

ENV = load_env()
SUPABASE_URL = ENV.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = ENV.get('SUPABASE_SERVICE_KEY', '')

# デバッグ用ログ
print(f'[ENV] SUPABASE_URL: {SUPABASE_URL[:40]}...' if SUPABASE_URL else '[ENV] SUPABASE_URL: NOT SET')
print(f'[ENV] SUPABASE_SERVICE_KEY: {"SET" if SUPABASE_SERVICE_KEY else "NOT SET"}')

async def scrape_athome(url: str) -> dict:
    """athomeページをスクレイピングして物件情報を返す"""
    from playwright.async_api import async_playwright
    from playwright_stealth import Stealth
    from bs4 import BeautifulSoup

    # URLからクリーンなベースURLを取得
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
    }

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='ja-JP',
        )
        page = await context.new_page()
        print(f'[scrape] アクセス中: {clean_url}')
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
        await page.wait_for_timeout(3000)
        await page.evaluate('window.scrollTo(0, 0)')
        await page.wait_for_timeout(500)

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # タイトル
        title_tag = soup.find('title')
        if title_tag:
            t = title_tag.get_text(strip=True)
            t = re.sub(r'【[^】]+】', '', t).strip()
            result['title'] = t

        # 画像取得
        seen = set()
        images = []
        slide_imgs = await page.query_selector_all("[class*='slide'] img")
        for img in slide_imgs:
            src = await img.get_attribute('src')
            if src and ('image_files/path' in src or 'data_images' in src):
                if '.svg' in src:
                    continue
                if src.startswith('/'):
                    src = f"https://www.athome.co.jp{src}"
                if 'width=' in src:
                    src = re.sub(r'width=\d+', 'width=800', src)
                if 'height=' in src:
                    src = re.sub(r'height=\d+', 'height=600', src)
                if src not in seen:
                    seen.add(src)
                    images.append(src)

        all_imgs = await page.query_selector_all('img')
        for img in all_imgs:
            src = await img.get_attribute('src')
            if src and ('image_files/path' in src or 'data_images' in src):
                if '.svg' in src:
                    continue
                if src in seen:
                    continue
                if src.startswith('/'):
                    src = f"https://www.athome.co.jp{src}"
                if 'width=' in src:
                    src = re.sub(r'width=\d+', 'width=800', src)
                if 'height=' in src:
                    src = re.sub(r'height=\d+', 'height=600', src)
                if src not in seen:
                    seen.add(src)
                    images.append(src)

        result['images'] = images
        print(f'[scrape] 画像: {len(images)}枚')

        # 緯度経度
        lats = list(set(re.findall(r'3[0-9]\.\d{5,}', html)))
        lngs = list(set(re.findall(r'13[0-9]\.\d{5,}', html)))
        if lats:
            result['lat'] = float(lats[0])
        if lngs:
            result['lng'] = float(lngs[0])
        print(f'[scrape] 座標: lat={result["lat"]}, lng={result["lng"]}')

        # 詳細テーブル
        details = {}
        for table in soup.find_all('table'):
            for row in table.find_all('tr'):
                th = row.find('th')
                td = row.find('td')
                if th and td:
                    k = th.get_text(strip=True)
                    v = td.get_text(strip=True)
                    if k and v:
                        details[k] = v

        for dl in soup.find_all('dl'):
            for dt, dd in zip(dl.find_all('dt'), dl.find_all('dd')):
                k = dt.get_text(strip=True)
                v = dd.get_text(strip=True)
                if k and v:
                    details[k] = v

        overview_section = soup.find('h2', string=re.compile(r'物件概要'))
        if overview_section:
            next_elem = overview_section.find_next_sibling()
            while next_elem:
                if next_elem.name == 'table':
                    for row in next_elem.find_all('tr'):
                        th = row.find('th')
                        td = row.find('td')
                        if th and td:
                            k = th.get_text(strip=True)
                            v = td.get_text(strip=True)
                            if k and v:
                                details[k] = v
                elif next_elem.name == 'dl':
                    for dt, dd in zip(next_elem.find_all('dt'), next_elem.find_all('dd')):
                        k = dt.get_text(strip=True)
                        v = dd.get_text(strip=True)
                        if k and v:
                            details[k] = v
                elif next_elem.name == 'h2':
                    break
                next_elem = next_elem.find_next_sibling()

        result['details'] = details
        print(f'[scrape] 詳細情報: {len(details)}項目')

        # ポイント
        points = []
        point_section = soup.find('h2', string=re.compile(r'ポイント'))
        if point_section:
            next_elem = point_section.find_next_sibling()
            while next_elem:
                if next_elem.name == 'ul':
                    for li in next_elem.find_all('li'):
                        text = li.get_text(strip=True)
                        if text and len(text) > 30:
                            points.append(text)
                elif next_elem.name == 'div':
                    point_texts = next_elem.find_all('p', class_=lambda x: x and 'point-text' in x)
                    if point_texts:
                        for p in point_texts:
                            text = p.get_text(strip=True)
                            if text and len(text) > 30:
                                points.append(text)
                    else:
                        text = next_elem.get_text(strip=True)
                        if text and len(text) > 30:
                            lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 30]
                            points.extend(lines)
                elif next_elem.name == 'h2':
                    break
                next_elem = next_elem.find_next_sibling()

        all_point_texts = soup.find_all('p', class_=lambda x: x and 'point-text' in x)
        print(f'[scrape] point-text要素: {len(all_point_texts)}個見つかりました')
        for p in all_point_texts:
            text = p.get_text(strip=True)
            if text and len(text) > 30 and text not in points:
                points.append(text)

        result['points'] = points
        print(f'[scrape] ポイント: {len(points)}項目')

        # 主要フィールド抽出
        field_map = {
            'price': ['価格'],
            'address': ['所在地'],
            'access': ['交通'],
            'layout': ['間取り'],
            'area': ['専有面積', '土地面積', '建物面積'],
            'floor': ['階建 / 階', '階建/階'],
            'built_year': ['築年月'],
            'parking': ['駐車場'],
            'features': ['設備・サービス', 'その他'],
            'remarks': ['備考'],
        }
        for field, keys in field_map.items():
            for k in keys:
                if k in details and details[k] and details[k] != '－':
                    result[field] = details[k]
                    break

        await browser.close()

    return result


def save_to_supabase(data: dict, region: str = 'oita', process_images_flag: bool = False) -> str:
    """Supabaseにデータを保存してslugを返す"""
    import urllib.request

    slug = uuid.uuid4().hex[:12]
    images = data.get('images', [])

    # OpenAI画像処理
    if process_images_flag and images:
        try:
            print(f"[OpenAI] Processing {len(images)} images...")
            processed_image_urls = process_images_with_openai(images)
            images = processed_image_urls
            print(f"[OpenAI] Successfully processed {len(processed_image_urls)} images")
        except Exception as e:
            print(f"[OpenAI] Error processing images: {e}")
            import traceback
            traceback.print_exc()

    payload = {
        'slug': slug,
        'source_url': data.get('source_url', ''),
        'title': data.get('title'),
        'price': data.get('price'),
        'address': data.get('address'),
        'access': data.get('access'),
        'layout': data.get('layout'),
        'area': data.get('area'),
        'floor': data.get('floor'),
        'built_year': data.get('built_year'),
        'parking': data.get('parking'),
        'features': data.get('features'),
        'remarks': data.get('remarks'),
        'images': images,
        'lat': data.get('lat'),
        'lng': data.get('lng'),
        'details': data.get('details', {}),
        'points': data.get('points', []),
        'region': region,
        'is_active': True,
        'processed_images': process_images_flag,
    }

    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/property_previews',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Prefer': 'return=minimal',
        },
        method='POST',
    )

    with urllib.request.urlopen(req, timeout=15) as resp:
        print(f'[supabase] 保存完了: slug={slug}, status={resp.status}')

    return slug


class ScrapeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'[HTTP] {format % args}')

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors()
        self.end_headers()

    def _set_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != '/scrape':
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            req_data = json.loads(body)
            url = req_data.get('url', '').strip()
            region = req_data.get('region', 'oita')
            process_images_flag = req_data.get('process_images', False)

            if not url:
                raise ValueError('URLが指定されていません')

            print(f'[scrape] リクエスト受信: {url} (region={region}, process_images={process_images_flag})')

            data = asyncio.run(scrape_athome(url))
            slug = save_to_supabase(data, region=region, process_images_flag=process_images_flag)

            response = {
                'success': True,
                'slug': slug,
                'data': data,
                'preview_url': f'https://sateituikyaku-admin-frontend.vercel.app/property-preview/{slug}',
            }

            self.send_response(200)
            self._set_cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            print(f'[scrape] エラー: {e}')
            import traceback
            traceback.print_exc()

            self.send_response(500)
            self._set_cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'success': False, 'error': str(e)}, ensure_ascii=False).encode('utf-8'))


if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 8765))
    import sys
    sys.stdout.flush()
    print('=' * 50, flush=True)
    print('🚀 スクレイピングAPIサーバー起動中...', flush=True)
    print(f'   Port: {PORT}', flush=True)
    print(f'   Supabase URL: {SUPABASE_URL[:40]}...' if SUPABASE_URL else '   ⚠️ Supabase URL未設定', flush=True)
    print(f'   Supabase Key: {"SET ✓" if SUPABASE_SERVICE_KEY else "NOT SET ✗"}', flush=True)
    print(f'   ヘルスチェック: http://localhost:{PORT}/health', flush=True)
    print(f'   スクレイピング: POST http://localhost:{PORT}/scrape', flush=True)
    print('=' * 50, flush=True)
    sys.stdout.flush()

    server = HTTPServer(('0.0.0.0', PORT), ScrapeHandler)
    server.serve_forever()
