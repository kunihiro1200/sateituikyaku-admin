---
inclusion: manual
---



# Athomeスクレイピングガイド

## 概要

Athome（アットホーム）の物件ページをスクレイピングして、画像、地図座標、ポイントテキストを取得する機能の実装ガイド。

---

## 🚨 最重要：スクレイピングサーバー保護ルール

**スクレイピングサーバー（`sateituikyaku-scrape-server`リポジトリ）のコードは慎重に変更する。**

### 安定バージョン

- **リポジトリ**: `https://github.com/kunihiro1200/sateituikyaku-scrape-server.git`
- **ブランチ**: `main`
- **安定タグ**: `v1.0-stable` (コミット `db5f531`)
- **デプロイ先**: Railway (`https://sateituikyaku-scrape-server-production.up.railway.app`)

### 動作確認済み機能

1. **地図表示**: ✅ 正しく動作
2. **ポイントテキスト取得**: ✅ 正しく動作（30文字以上のテキストのみ）
3. **画像取得**: ✅ 正しく動作（44枚）
4. **建売専門HP**: ✅ 正しく動作

---

## 📋 実装の詳細

### 1. 地図の座標取得

**絶対に変更してはいけない部分**：

```python
# 緯度経度
lats = list(set(re.findall(r'3[0-9]\.\d{5,}', html)))
lngs = list(set(re.findall(r'13[0-9]\.\d{5,}', html)))
if lats:
    result['lat'] = float(lats[0])
if lngs:
    result['lng'] = float(lngs[0])
```

**理由**: 
- このシンプルな正規表現が最も確実に動作する
- 複雑な改善を試みると、Railwayで動作しなくなる可能性が高い

---

### 2. ポイントテキストの取得

**正しい実装**：

```python
# 「ポイント」セクションを取得（「設備・仕様・構造」は除外）
points = []
point_section = soup.find('h2', string=re.compile(r'ポイント'))
if point_section:
    next_elem = point_section.find_next_sibling()
    while next_elem:
        if next_elem.name == 'ul':
            for li in next_elem.find_all('li'):
                text = li.get_text(strip=True)
                # 長いテキストのみ取得（30文字以上）
                if text and len(text) > 30:
                    points.append(text)
        elif next_elem.name == 'div':
            # div内の<p class="point-text">を柔軟に取得（ngcontent属性対応）
            point_texts = next_elem.find_all('p', class_=lambda x: x and 'point-text' in x)
            if point_texts:
                for p in point_texts:
                    text = p.get_text(strip=True)
                    # 長いテキストのみ取得（30文字以上）
                    if text and len(text) > 30:
                        points.append(text)
        elif next_elem.name == 'h2':
            break
        next_elem = next_elem.find_next_sibling()

# point-textクラスを持つ全てのp要素を取得
all_point_texts = soup.find_all('p', class_=lambda x: x and 'point-text' in x)
for p in all_point_texts:
    text = p.get_text(strip=True)
    if text and len(text) > 30 and text not in points:
        points.append(text)
```

**重要なポイント**：

1. **「ポイント」セクションだけを取得**
   - `r'ポイント'`で検索（`r'(ポイント|設備・仕様・構造)'`は使わない）
   - 「設備・仕様」セクションは除外する

2. **30文字以上のテキストのみ取得**
   - 画像のキャプション（「キッチン　完成予想図」など）は短いので除外される
   - 詳細な箇条書きテキスト（「◆制震構造制震ユニット...」など）のみ取得される

3. **`point-text`クラスの柔軟な検索**
   - `class_=lambda x: x and 'point-text' in x`を使用
   - Angular特有の`ngcontent-*`属性に対応

---

### 3. 画像取得

**実装**：

```python
# 1. スライダー画像を取得
slide_imgs = await page.query_selector_all("[class*='slide'] img")
for img in slide_imgs:
    src = await img.get_attribute('src')
    if src and ('image_files/path' in src or 'data_images' in src):
        if '.svg' in src:
            continue
        if src.startswith('/'):
            src = f"https://www.athome.co.jp{src}"
        if src not in seen:
            seen.add(src)
            images.append(src)

# 2. 設備・仕様・構造セクションの画像を取得
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
        if src not in seen:
            seen.add(src)
            images.append(src)
```

**重要なポイント**：
- `image_files/path`と`data_images`の両方のURLパターンに対応
- SVGアイコンは除外
- 重複を防ぐために`seen`セットを使用

---

## 🔧 Playwright設定

### ブラウザ

**Chromium**を使用（Firefoxは失敗する）

```python
from playwright_stealth import Stealth

async with Stealth().use_async(async_playwright()) as p:
    browser = await p.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport={'width': 1280, 'height': 800},
        locale='ja-JP',
    )
    page = await context.new_page()
```

**重要**：
- `playwright-stealth`を使用してボット検出を回避
- `Stealth().use_async()`構文を使用

### 待機時間

```python
await page.goto(clean_url, wait_until='domcontentloaded', timeout=60000)
await page.wait_for_timeout(3000)  # 初期読み込み

# スクロール
await page.evaluate("""...""")
await page.wait_for_timeout(3000)  # 地図読み込みのために3秒待機
```

**重要**：
- スクロール後に3秒待機（地図の読み込みに必要）
- 2秒では不十分

---

## 🐛 トラブルシューティング

### 問題1: 地図が海を表示する

**原因**: データベースに古いデータが残っている

**解決策**:
1. 新しいURLでスクレイピングをテストする
2. または、データベースから該当レコードを削除：

```sql
-- 座標がNULLのレコードを削除
DELETE FROM property_previews 
WHERE lat IS NULL OR lng IS NULL;

-- 特定のURLのレコードを削除
DELETE FROM property_previews 
WHERE source_url LIKE '%物件番号%';
```

### 問題2: ポイントテキストが取得できない

**原因**: 
- 「設備・仕様」セクションから取得している
- 短いテキスト（画像のキャプション）も取得している

**解決策**:
- `r'ポイント'`で検索（`r'(ポイント|設備・仕様・構造)'`は使わない）
- 30文字以上のテキストのみ取得

### 問題3: 画像が1枚しか取得できない

**原因**: `data_images`URLパターンに対応していない

**解決策**:
- `'image_files/path' in src or 'data_images' in src`の両方をチェック

---

## 📝 デプロイ手順

### ローカルからRailwayへのデプロイ

```bash
# 1. ワークスペースのファイルを編集
# scrape_server.py を編集

# 2. Railwayリポジトリにコピー
Copy-Item -Path "scrape_server.py" -Destination "C:\Users\kunih\sateituikyaku-scrape-server\scrape_server.py" -Force

# 3. コミット・プッシュ
cd C:\Users\kunih\sateituikyaku-scrape-server
git add scrape_server.py
git commit -m "fix: description"
git push
```

### 安定バージョンへの復元

```bash
cd C:\Users\kunih\sateituikyaku-scrape-server
git checkout v1.0-stable
git checkout main
git reset --hard v1.0-stable
git push -f origin main
```

---

## 📊 テスト方法

### 1. 新しいURLでテスト

```
https://www.athome.co.jp/kodate/新しい物件番号/?DOWN=1&BKLISTID=001LPC&SEARCHDIV=1&sref=list_simple
```

### 2. 確認項目

- [ ] 画像が40枚以上取得できているか
- [ ] 地図が正しい位置を表示しているか（海ではない）
- [ ] ポイントテキストが詳細な箇条書き（30文字以上）か
- [ ] 画像のキャプション（「キッチン　完成予想図」など）が除外されているか

### 3. Railwayログの確認

```
[scrape] 画像: 44枚
[scrape] 座標: lat=33.24624077, lng=131.633081
[scrape] point-text要素: X個見つかりました
[scrape] ポイント: Y項目
```

---

## 🎯 まとめ

### 成功の鍵

1. **地図のコードは絶対に変更しない**
2. **「ポイント」セクションだけを取得**
3. **30文字以上のテキストのみ取得**
4. **Chromium + playwright-stealthを使用**
5. **新しいURLでテスト**

### 避けるべきこと

- ❌ 地図の座標取得ロジックを改善しようとする
- ❌ 「設備・仕様・構造」セクションも取得する
- ❌ 短いテキスト（2文字以上）も取得する
- ❌ Firefoxを使用する
- ❌ 同じURLで何度もテストする

---

**最終更新日**: 2026年5月6日
**作成理由**: Athomeスクレイピング機能の実装経験を記録し、今後の参考にするため
