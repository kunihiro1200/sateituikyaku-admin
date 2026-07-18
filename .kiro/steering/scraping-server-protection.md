---
inclusion: auto
---

# スクレイピングサーバー保護ルール

## ⚠️ 絶対に守るべきルール

**スクレイピングサーバー（`sateituikyaku-scrape-server`リポジトリ）を変更する際は、以下の保護対象機能に絶対に影響を与えないこと。**

---

## 🔴 絶対に影響を与えてはいけない機能（2つ）

### 1. 他社物件新着配信（BuyersPage → OtherCompanyDistributionPage）
- athomeのURLをスクレイピングして買主に配信する機能
- バックエンド: `backend/src/routes/tateuriPreview.ts` の `/api/tateuri/scrape`（athome用）
- スクレイピングサーバーの `scrape_athome()` 関数が担当
- **この関数には一切触れない**

### 2. 大分建売専門HP（/tateuri, /tateuri/manage）
- athomeのURLをスクレイピングして大分の建売物件を掲載する機能
- `region = 'oita'` のデータを使用
- スクレイピングサーバーの `scrape_athome()` 関数 + `save_to_supabase()` が担当
- **この関数には一切触れない**

---

## ✅ 変更してOKな内容

### SUUMO対応の追加（2026年5月追加）
- 福岡建売専門HP（`/fukuoka-tateuri`）用にSUUMOのURLをスクレイピングする機能
- **追加のみ許可**（既存コードの変更は禁止）
- `scrape_suumo()` という**新しい関数**として追加する
- `save_to_supabase()` は変更せず、`region` パラメータはバックエンド側で後から更新する

---

## 📍 現在の安定バージョン

- **リポジトリ**: `https://github.com/kunihiro1200/sateituikyaku-scrape-server.git`
- **ブランチ**: `main`
- **安定タグ**: `v1.0-stable`（コミット: `db5f531`）
- **デプロイ先**: Railway (`https://sateituikyaku-scrape-server-production.up.railway.app`)

---

## ✅ 動作確認済み機能（変更禁止）

1. **地図表示（大分）**: ✅ 正しく動作
2. **ポイントテキスト取得**: ✅ 正しく動作
3. **画像取得（athome）**: ✅ 正しく動作（44枚）
4. **大分建売専門HP**: ✅ 正しく動作
5. **他社物件新着配信**: ✅ 正しく動作
6. **他社物件新着配信の地図座標（`/scrape-preview`）**: ✅ 正しく動作（2026年6月8日修正・確認済み）

---

## 🚫 絶対に変更してはいけないコード

### 1. 座標抽出ロジック（`scrape_athome()` 内・変更禁止）

```python
# 緯度経度（絶対に変更しない）
lats = list(set(re.findall(r'3[0-9]\.\d{5,}', html)))
lngs = list(set(re.findall(r'13[0-9]\.\d{5,}', html)))
if lats:
    result['lat'] = float(lats[0])
if lngs:
    result['lng'] = float(lngs[0])
```

※ この正規表現ロジックは `set()` の順序不定により、周辺施設の座標が選ばれることがある。
しかし `scrape_athome()` 本体は変更禁止。`/scrape-preview` 専用の後処理（下記）で対応済み。

### 2. `fix_athome_coords_for_preview()` 関数（変更禁止・削除禁止）

```python
def fix_athome_coords_for_preview(url: str, data: dict) -> None:
```

- **他社物件新着配信（`/scrape-preview`）専用の座標補正関数**
- `scrape_athome()` が返す座標が周辺施設のものになってしまう問題を修正（2026年6月8日追加）
- athome HTMLの `"ido"`/`"keido"` キー（物件本体の正確な座標）を urllib で再取得して上書きする
- athome URL 以外（SUUMOなど）は何もしない
- `/scrape` エンドポイント・`scrape_athome()` 本体には一切影響しない
- **この関数を削除・変更すると地図が再びずれる**

### 3. `scrape_athome()` 関数（変更禁止）
- athome専用のスクレイピング関数
- 他社物件配信・大分建売専門HPの両方が依存している
- **一切変更しない**

### 4. `save_to_supabase()` 関数（変更禁止）
- DBへの保存処理
- 既存の動作に影響するため変更しない

### 5. `ScrapeHandler.do_POST()` の既存ロジック（変更禁止）
- `scrape_athome()` を呼び出す既存のフロー
- **変更しない**

### 6. Playwrightの基本設定（変更禁止）
- ブラウザ起動設定
- User-Agent設定

---

## ✅ SUUMO対応の正しい追加方法

### 原則：既存コードに触れず、新しい関数を追加するだけ

```python
# ✅ 正しい追加方法
async def scrape_suumo(url: str) -> dict:
    # SUUMOページをスクレイピングする新しい関数
    # scrape_athome() とは完全に独立
    ...

# do_POST() の中で、URLに応じて分岐（既存ロジックの後に追加）
# ✅ 既存コードを変更せず、elif で追加
if 'athome.co.jp' in url or not url.startswith('https://suumo.jp'):
    data = asyncio.run(scrape_athome(url))  # 既存（変更しない）
elif 'suumo.jp' in url:
    data = asyncio.run(scrape_suumo(url))   # 新規追加
```

---

## 🔧 万が一問題が起きた場合

### ステップ1: 安定バージョンに戻す

```bash
cd C:\Users\kunih\sateituikyaku-scrape-server
git checkout v1.0-stable
git push -f origin main
```

### ステップ2: Railwayが再デプロイするのを待つ

### ステップ3: 動作確認

大分建売専門HPと他社物件配信でスクレイピングを実行して、正しく動作することを確認。

---

## 📝 変更履歴

| 日付 | 変更内容 | 結果 |
|------|---------|------|
| 2026-05-06 | 地図の座標抽出ロジックを改善しようとした | ❌ Railwayで動作しなくなった |
| 2026-05-06 | 元のバージョン（`2605308`）に戻した | ✅ 全て正しく動作 |
| 2026-05-06 | `v1.0-stable`タグを作成 | ✅ バックアップ完了 |
| 2026-05-09 | SUUMO対応を追加（scrape_suumo関数を新規追加） | 確認中 |
| 2026-06-08 | 他社物件新着配信の地図座標が周辺施設の座標になる問題を修正 | ✅ 正しく動作 |

**2026-06-08 修正の詳細**:
- 原因: `scrape_athome()` 内の `set()` は順序不定のため、ページ内に複数の座標（物件本体・周辺施設）がある場合に周辺施設の座標が選ばれることがあった
- 修正: `scrape_athome()` は変更せず、`/scrape-preview` エンドポイントの後処理として `fix_athome_coords_for_preview()` を追加
- 効果: athome HTMLの `"ido"`/`"keido"` キー（物件本体の正確な座標）で上書き補正
- 影響範囲: `/scrape-preview`（他社物件新着配信）のみ。`/scrape`（大分建売専門HP）は変更なし

---

## 🎯 まとめ

**`scrape_athome()`・`save_to_supabase()`・座標抽出ロジックは絶対に変更しない。**

**SUUMO対応は `scrape_suumo()` という新しい関数を追加するだけ。既存コードには一切触れない。**

**万が一問題が起きても、`v1.0-stable`タグに戻せば復旧できる。**

---

**最終更新日**: 2026年6月8日
**更新理由**: 他社物件新着配信の地図座標修正（`fix_athome_coords_for_preview`追加）を保護対象に追加

---

## 📍 他社物件新着配信（`/api/buyers/scrape-property`）の座標取得ルール

**実装ファイル**: `backend/src/routes/buyers.ts`（Railwayではなくバックエンド内で直接処理）

### 🚨 絶対に守るべきルール：座標はJSON-LDから取得する

athomeのHTMLには `<script type="application/ld+json">` に正確な物件座標が埋め込まれている。

```
{"@type":"GeoCoordinates","latitude":"33.51682","longitude":"130.4678"}
```

**この値を最優先で使うこと。**

### ❌ 過去にやった間違い（繰り返し禁止）

1. `set()` + 正規表現で緯度経度を拾う → **周辺施設の座標が混入して駅付近にピンが刺さる**
2. `"ido"`/`"keido"` キーを探す → **このページには存在しない（別のathomeページ用）**
3. Google Geocoding APIで住所から座標を取得 → **マンション名が住所に含まれると駅付近に引っ張られる**
4. 住所から郵便番号・マンション名を除去してジオコーディング → **登録住所と実際の物件位置が異なるケースで不正確**

### ✅ 正しい実装（2026年6月26日確認済み）

```typescript
// 優先1: JSON-LDの GeoCoordinates（物件本体の正確な座標）
const geoCoordMatch = html.match(/"GeoCoordinates"[^}]*"latitude"\s*:\s*"?([0-9]{2}\.[0-9]+)"?[^}]*"longitude"\s*:\s*"?([0-9]{3}\.[0-9]+)"?/);
const geoCoordMatchRev = !geoCoordMatch && html.match(/"GeoCoordinates"[^}]*"longitude"\s*:\s*"?([0-9]{3}\.[0-9]+)"?[^}]*"latitude"\s*:\s*"?([0-9]{2}\.[0-9]+)"?/);
if (geoCoordMatch) {
  lat = parseFloat(geoCoordMatch[1]);
  lng = parseFloat(geoCoordMatch[2]);
} else if (geoCoordMatchRev) {
  lng = parseFloat(geoCoordMatchRev[1]);
  lat = parseFloat(geoCoordMatchRev[2]);
} else {
  // フォールバック: center=lat,lng → 汎用正規表現
}
```

### ✅ タイトルの提供元情報の除去（2026年6月26日確認済み）

athomeのタイトルには「（提供元：〇〇不動産）」が含まれる場合がある。除去すること。

```typescript
title = title
  .replace(/【[^】]+】/g, '')
  .replace(/（提供元[^）]*）/g, '')  // 全角括弧
  .replace(/\(提供元[^)]*\)/g, '')   // 半角括弧
  .replace(/\s*[-|｜].*$/, '')
  .trim();
```

### ✅ DB保存とプレビューURL生成（2026年6月26日追加）

`scrape-property`（athome用）はスクレイピング後に `property_previews` テーブルへ保存し、
`https://sateituikyaku-admin-frontend.vercel.app/property-preview/{slug}` を返す。
（以前は元URLをそのまま返していたため、プレビューが古いページのままになっていた）

---

**最終更新日**: 2026年6月26日
**更新理由**: athome scrape-propertyの地図座標・タイトル・プレビューURL問題を修正・記録
