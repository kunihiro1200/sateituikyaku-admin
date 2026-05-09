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

---

## 🚫 絶対に変更してはいけないコード

### 1. 座標抽出ロジック（変更禁止）

```python
# 緯度経度（絶対に変更しない）
lats = list(set(re.findall(r'3[0-9]\.\d{5,}', html)))
lngs = list(set(re.findall(r'13[0-9]\.\d{5,}', html)))
if lats:
    result['lat'] = float(lats[0])
if lngs:
    result['lng'] = float(lngs[0])
```

### 2. `scrape_athome()` 関数（変更禁止）
- athome専用のスクレイピング関数
- 他社物件配信・大分建売専門HPの両方が依存している
- **一切変更しない**

### 3. `save_to_supabase()` 関数（変更禁止）
- DBへの保存処理
- 既存の動作に影響するため変更しない

### 4. `ScrapeHandler.do_POST()` の既存ロジック（変更禁止）
- `scrape_athome()` を呼び出す既存のフロー
- **変更しない**

### 5. Playwrightの基本設定（変更禁止）
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

---

## 🎯 まとめ

**`scrape_athome()`・`save_to_supabase()`・座標抽出ロジックは絶対に変更しない。**

**SUUMO対応は `scrape_suumo()` という新しい関数を追加するだけ。既存コードには一切触れない。**

**万が一問題が起きても、`v1.0-stable`タグに戻せば復旧できる。**

---

**最終更新日**: 2026年5月9日
**更新理由**: 福岡建売専門HP（SUUMO対応）追加に伴い、保護対象を明確化
