# Railwayデプロイ状況

## ✅ 完了した作業

1. **地図座標の取得精度を改善**
   - Google Maps URLから座標を抽出するパターンを追加
   - centerパラメータから座標を抽出するパターンを追加
   - デバッグログを追加（どの座標候補が見つかったか）

2. **Gitにコミット＆プッシュ**
   - コミットID: `602ff79`
   - ブランチ: `master`
   - リポジトリ: `https://github.com/kunihiro1200/sateituikyaku-scrape-server.git`

## 🚀 次のステップ

### 1. Railwayのデプロイ状況を確認

1. https://railway.app/ にアクセス
2. `scrape-server` プロジェクトを開く
3. 「Deployments」タブを確認
4. 最新のデプロイ（`602ff79`）が「Success」になるまで待つ（通常3-5分）

### 2. ヘルスチェック

デプロイが完了したら、以下のURLにアクセスして動作確認：

```
https://scrape-server-production-XXXX.up.railway.app/health
```

**期待されるレスポンス**:
```json
{"status": "ok"}
```

### 3. 「他社物件新着配信」ページで動作確認

1. https://sateituikyaku-admin-frontend.vercel.app/buyers/other-company-distribution にアクセス
2. アットホームのURLを入力（例: `https://www.athome.co.jp/mansion/6990582043/`）
3. 「物件情報を取得」ボタンをクリック
4. 地図の位置が正しいか確認

### 4. デバッグログの確認（必要に応じて）

Railwayのログで以下のような出力を確認：

```
[scrape] Latitude: 33.227352 (from 1 candidates)
[scrape] Longitude: 131.5869995 (from 1 candidates)
```

これにより、どの座標候補が使用されたかを確認できます。

## 🐛 トラブルシューティング

### 問題1: デプロイが失敗する

**確認事項**:
1. Railwayのデプロイログを確認
2. エラーメッセージを確認
3. 必要に応じて再デプロイ

### 問題2: 地図の位置がまだズレている

**対処法**:
1. Railwayのログで座標候補を確認
2. アットホームのページのHTMLソースを確認
3. 正しい座標が含まれているか確認
4. 必要に応じて正規表現パターンを調整

### 問題3: ヘルスチェックが失敗する

**確認事項**:
1. Railwayのサービスが起動しているか確認
2. 環境変数が正しく設定されているか確認
3. ポート番号が正しいか確認（デフォルト: 8080）

## 📝 環境変数（確認用）

Railwayの環境変数が正しく設定されているか確認：

| 変数名 | 値 | 必須 |
|-------|---|------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | ✅ |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | ✅ |
| `PORT` | `8080` | ✅（Railwayが自動設定） |

## 📊 デプロイ履歴

| 日時 | コミットID | 変更内容 | 状態 |
|------|-----------|---------|------|
| 2026-05-05 | `602ff79` | 地図座標の取得精度を改善 | デプロイ中... |

---

**最終更新**: 2026年5月5日
