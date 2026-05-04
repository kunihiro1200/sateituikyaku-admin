# -*- coding: utf-8 -*-
"""
athome物件ページから画像・コメント・物件情報を取得するスクリプト（拡張版）
建売物件向けに以下を追加：
- ポイントセクション
- 画像カテゴリ分類（区画・間取り / 外観・室内）
- 建売向けフィールド（販売スケジュール、引渡可能時期、完成時期）
"""

import asyncio
import json
import re
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from bs4 import BeautifulSoup


async def scrape_athome_property(url: str) -> dict:
    """
    athomeの物件ページから情報を取得する

    Args:
        url: athomeの物件URL

    Returns:
        物件情報の辞書
    """
    result = {
        "url": url,
        "title": None,
        "price": None,
        "address": None,
        "description": None,
        "images": [],
        "details": {},
        "comments": [],
        "points": [],  # 新規: ポイントセクション
        "image_categories": {},  # 新規: 画像カテゴリ
    }

    # ネットワークで傍受した画像URL
    intercepted_image_urls = set()

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="ja-JP",
        )
        page = await context.new_page()

        # ネットワークリクエストを傍受して画像URLを収集
        async def handle_request(request):
            req_url = request.url
            if _is_property_image(req_url):
                intercepted_image_urls.add(req_url)

        page.on("request", handle_request)

        print(f"ページを読み込み中: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(3000)

        # ページを下までスクロールして遅延読み込み画像を全て取得
        print("ページをスクロールして全画像を読み込み中...")
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

        # ページトップに戻る
        await page.evaluate("window.scrollTo(0, 0)")
        await page.wait_for_timeout(1000)

        # HTMLを取得してBeautifulSoupで解析
        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        # ---- タイトル取得 ----
        title_el = soup.select_one("h1.bukken-name, h1.property-name, h1[class*='title'], .bukken-title h1")
        if title_el:
            result["title"] = title_el.get_text(strip=True)
        else:
            # ページタイトルから取得
            title_tag = soup.find("title")
            if title_tag:
                result["title"] = title_tag.get_text(strip=True)

        # ---- 価格取得 ----
        price_el = soup.select_one(".price, .bukken-price, [class*='price']")
        if price_el:
            result["price"] = price_el.get_text(strip=True)

        # ---- 住所取得 ----
        address_el = soup.select_one(".address, .bukken-address, [class*='address']")
        if address_el:
            result["address"] = address_el.get_text(strip=True)

        # ---- ポイントセクション取得（新規）----
        # athomeの「ポイント」「おすすめポイント」「物件の特徴」などのセクション
        point_selectors = [
            ".point-list li",
            ".recommend-point li",
            ".feature-list li",
            "[class*='point'] li",
            "[class*='feature'] li",
            ".appeal-point li",
        ]
        points_set = set()
        for selector in point_selectors:
            els = soup.select(selector)
            for el in els:
                text = el.get_text(strip=True)
                # 短すぎるテキストや重複を除外
                if text and len(text) > 5 and text not in points_set:
                    points_set.add(text)
        
        result["points"] = list(points_set)
        print(f"ポイント: {len(result['points'])}件")

        # ---- 物件コメント・説明文取得 ----
        # athomeの物件コメントは複数のセレクタで存在する可能性がある
        comment_selectors = [
            ".bukken-comment",
            ".property-comment",
            ".comment-body",
            "[class*='comment']",
            ".bukken-detail-comment",
            ".detail-comment",
            ".property-description",
            "[class*='description']",
            ".pr-text",
            ".appeal-text",
        ]
        for selector in comment_selectors:
            els = soup.select(selector)
            for el in els:
                text = el.get_text(strip=True)
                if text and len(text) > 10 and text not in result["comments"]:
                    result["comments"].append(text)

        if result["comments"]:
            result["description"] = result["comments"][0]

        # ---- 画像URL取得（スライダーの画像）----
        # margin=false パラメータ付きのURLがスライダー本体の画像
        slide_imgs = await page.query_selector_all("[class*='slide'] img")
        image_urls = []
        image_with_labels = []  # (url, label) のタプルリスト
        seen = set()
        
        for img in slide_imgs:
            src = await img.get_attribute("src")
            alt = await img.get_attribute("alt") or ""
            
            if src and "image_files/path" in src and "margin=false" in src:
                # 高解像度に変換
                large = re.sub(r'width=\d+', 'width=800', src)
                large = re.sub(r'height=\d+', 'height=600', large)
                if large not in seen:
                    seen.add(large)
                    image_urls.append(large)
                    image_with_labels.append((large, alt))

        print(f"スライダー画像: {len(image_urls)}枚")
        result["images"] = image_urls

        # ---- 画像カテゴリ分類（新規）----
        # alt属性やコメントから画像の種類を判定
        layout_keywords = ["間取", "区画", "配置", "プラン", "図面"]
        exterior_keywords = ["外観", "室内", "リビング", "キッチン", "バス", "トイレ", "洗面", "玄関", "バルコニー", "眺望", "収納"]
        
        layout_images = []
        exterior_images = []
        
        for url, label in image_with_labels:
            # alt属性やコメントから判定
            is_layout = any(kw in label for kw in layout_keywords)
            is_exterior = any(kw in label for kw in exterior_keywords)
            
            if is_layout:
                layout_images.append(url)
            elif is_exterior:
                exterior_images.append(url)
        
        # カテゴリに分類できた場合のみ追加
        if layout_images or exterior_images:
            result["image_categories"]["区画・間取り"] = layout_images
            result["image_categories"]["外観・室内"] = exterior_images
            print(f"画像カテゴリ: 区画・間取り {len(layout_images)}枚, 外観・室内 {len(exterior_images)}枚")

        # ---- 物件詳細情報取得（間取り・面積・築年数など）----
        # テーブル形式の詳細情報
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            for row in rows:
                th = row.find("th")
                td = row.find("td")
                if th and td:
                    key = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    if key and value:
                        result["details"][key] = value

        # dl/dt/dd形式の詳細情報
        for dl in soup.find_all("dl"):
            dts = dl.find_all("dt")
            dds = dl.find_all("dd")
            for dt, dd in zip(dts, dds):
                key = dt.get_text(strip=True)
                value = dd.get_text(strip=True)
                if key and value:
                    result["details"][key] = value

        # ---- 建売向けフィールド追加（新規）----
        # 「販売スケジュール」「引渡可能時期」「完成時期」などを探す
        # 既にdetailsに含まれている場合はそのまま、なければ追加で探す
        if "販売スケジュール" not in result["details"]:
            # ページ内から「販売スケジュール」を探す
            schedule_el = soup.find(string=re.compile(r"販売スケジュール"))
            if schedule_el:
                parent = schedule_el.find_parent()
                if parent:
                    # 次の要素から値を取得
                    next_el = parent.find_next_sibling()
                    if next_el:
                        result["details"]["販売スケジュール"] = next_el.get_text(strip=True)

        if "完成時期" not in result["details"]:
            # ページ内から「完成時期」を探す
            completion_el = soup.find(string=re.compile(r"完成時期"))
            if completion_el:
                parent = completion_el.find_parent()
                if parent:
                    next_el = parent.find_next_sibling()
                    if next_el:
                        result["details"]["完成時期"] = next_el.get_text(strip=True)

        # 「引渡可能時期」は既にdetailsに含まれている可能性が高い

        # ---- 緯度経度取得 ----
        # 大分の緯度(33.xx)・経度(131.xx)パターンで抽出
        lats = re.findall(r'33\.\d{5,}', html)
        lngs = re.findall(r'131\.\d{5,}', html)
        if lats:
            result["lat"] = float(list(dict.fromkeys(lats))[0])
        if lngs:
            result["lng"] = float(list(dict.fromkeys(lngs))[0])
        print(f"緯度: {result.get('lat')}, 経度: {result.get('lng')}")

        await browser.close()

    return result


def _is_property_image(url: str) -> bool:
    """物件画像のURLかどうか判定"""
    if not url:
        return False
    # athomeの画像ドメインを確認
    property_image_patterns = [
        "img.athome.co.jp",
        "athome.co.jp/img",
        "img01.athome",
        "img02.athome",
        "img03.athome",
        "img04.athome",
        "img05.athome",
        "athome-img",
    ]
    url_lower = url.lower()
    # 画像拡張子チェック
    has_image_ext = any(ext in url_lower for ext in [".jpg", ".jpeg", ".png", ".webp"])
    # athome関連ドメインチェック
    is_athome = "athome" in url_lower
    # アイコン・ロゴ等を除外
    is_icon = any(word in url_lower for word in ["icon", "logo", "banner", "btn", "arrow", "common"])

    return has_image_ext and is_athome and not is_icon


def _normalize_url(url: str) -> str:
    """URLを正規化（相対URLを絶対URLに変換）"""
    if not url:
        return None
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http"):
        return url
    return None


def save_results(data: dict, output_path: str = "athome_scrape_result.json"):
    """結果をJSONファイルに保存"""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n結果を保存しました: {output_path}")


def print_summary(data: dict):
    """取得結果のサマリーを表示"""
    print("\n" + "=" * 60)
    print("【取得結果サマリー】")
    print("=" * 60)
    print(f"タイトル: {data.get('title', '取得できませんでした')}")
    print(f"価格: {data.get('price', '取得できませんでした')}")
    print(f"住所: {data.get('address', '取得できませんでした')}")
    print(f"画像数: {len(data.get('images', []))}枚")
    print(f"コメント数: {len(data.get('comments', []))}件")
    print(f"詳細情報: {len(data.get('details', {}))}項目")
    print(f"ポイント: {len(data.get('points', []))}件")  # 新規
    
    # 画像カテゴリ
    if data.get("image_categories"):
        print(f"画像カテゴリ:")
        for cat, imgs in data["image_categories"].items():
            print(f"  - {cat}: {len(imgs)}枚")

    if data.get("images"):
        print("\n【画像URL（最初の5枚）】")
        for i, img_url in enumerate(data["images"][:5]):
            print(f"  {i+1}. {img_url}")
        if len(data["images"]) > 5:
            print(f"  ... 他{len(data['images'])-5}枚")

    if data.get("points"):
        print("\n【ポイント】")
        for i, point in enumerate(data["points"][:5]):
            print(f"  {i+1}. {point}")
        if len(data["points"]) > 5:
            print(f"  ... 他{len(data['points'])-5}件")

    if data.get("comments"):
        print("\n【コメント】")
        for i, comment in enumerate(data["comments"][:3]):
            print(f"  {i+1}. {comment[:100]}{'...' if len(comment) > 100 else ''}")

    if data.get("details"):
        print("\n【物件詳細（最初の10項目）】")
        for i, (key, value) in enumerate(list(data["details"].items())[:10]):
            print(f"  {key}: {value}")
        
        # 建売向けフィールドを強調表示
        if "販売スケジュール" in data["details"]:
            print(f"\n  ★ 販売スケジュール: {data['details']['販売スケジュール']}")
        if "引渡可能時期" in data["details"]:
            print(f"  ★ 引渡可能時期: {data['details']['引渡可能時期']}")
        if "完成時期" in data["details"]:
            print(f"  ★ 完成時期: {data['details']['完成時期']}")


async def main():
    import sys
    
    # コマンドライン引数からURLを取得
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        # デフォルトURL（中古マンション）
        target_url = "https://www.athome.co.jp/mansion/6990582043/"

    print(f"athome物件スクレイピング開始（拡張版）")
    print(f"URL: {target_url}")
    
    # URLの種類を判定
    if "/kodate/" in target_url:
        print("物件種別: 建売（一戸建て）")
    elif "/mansion/" in target_url:
        print("物件種別: 中古マンション")
    else:
        print("物件種別: その他")

    try:
        data = await scrape_athome_property(target_url)
        print_summary(data)
        save_results(data)
    except Exception as e:
        print(f"\nエラーが発生しました: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
