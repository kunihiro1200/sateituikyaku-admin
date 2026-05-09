# スクレイピングサーバー 価格取得機能の追加

## ⚠️ 重要

**`scraping-server-protection.md` のルールに従い、地図の座標抽出ロジックは絶対に変更しません。**

価格取得機能のみを追加します。

## 必要な変更

### スクレイピングサーバー（`sateituikyaku-scrape-server`）

現在のスクレイピングサーバーに以下の機能を追加する必要があります：

#### 1. 価格情報の取得

```python
# main.py に追加

# 価格情報を取得
price_text = None
try:
    # パターン1: "価格" または "販売価格" のテキストを探す
    price_element = page.locator('text=/価格|販売価格/').first
    if await price_element.count() > 0:
        price_text = await price_element.text_content()
    
    # パターン2: class名で探す（サイトによって異なる）
    if not price_text:
        price_element = page.locator('.price, .property-price, [class*="price"]').first
        if await price_element.count() > 0:
            price_text = await price_element.text_content()
    
    result['price_text'] = price_text
except Exception as e:
    print(f"価格取得エラー: {e}")
    result['price_text'] = None
```

#### 2. 売却済み・削除の判定

```python
# 売却済みの判定
sold = False
try:
    sold_element = page.locator('text=/売却済|成約済|SOLD/').first
    if await sold_element.count() > 0:
        sold = True
    result['sold'] = sold
except Exception as e:
    result['sold'] = False

# 404エラーの場合は削除と判定（既存のエラーハンドリングで対応）
```

#### 3. レスポンス例

```json
{
  "lat": 35.12345,
  "lng": 139.12345,
  "price_text": "3,980万円",
  "sold": false,
  "images": [...],
  "point_text": "..."
}
```

## テスト方法

### ローカルでテスト

```bash
# スクレイピングサーバーをローカルで起動
cd C:\Users\kunih\sateituikyaku-scrape-server
python main.py

# 別のターミナルでテスト
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/property/12345"}'
```

### Railwayでテスト

```bash
curl -X POST https://sateituikyaku-scrape-server-production.up.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/property/12345"}'
```

## 注意事項

1. **地図の座標抽出ロジックは絶対に変更しない**
2. 価格取得機能のみを追加する
3. 既存の機能（画像取得、ポイントテキスト取得）に影響を与えない
4. 変更後、必ずRailwayで動作確認する
5. 動作しなくなったら、すぐに `v1.0-stable` タグに戻す

## デプロイ手順

```bash
cd C:\Users\kunih\sateituikyaku-scrape-server

# 変更をコミット
git add main.py
git commit -m "feat: Add price extraction feature (without changing map logic)"

# Railwayにデプロイ
git push origin main

# Railwayが自動的に再デプロイするのを待つ
```

## 動作確認

```bash
# 価格が正しく取得できるか確認
curl -X POST https://sateituikyaku-scrape-server-production.up.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "実際の建売専門HPのURL"}' | jq .
```

**確認ポイント**:
- ✅ `price_text` フィールドが存在する
- ✅ 価格が正しく取得できている（例: "3,980万円"）
- ✅ 地図の座標（`lat`, `lng`）が正しく取得できている
- ✅ 画像が正しく取得できている
- ✅ ポイントテキストが正しく取得できている

---

**作成日**: 2026年5月6日
**注意**: スクレイピングサーバーのコードを変更する際は、必ず `scraping-server-protection.md` のルールを守ってください。
