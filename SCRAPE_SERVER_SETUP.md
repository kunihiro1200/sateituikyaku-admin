# 🚀 スクレイピングサーバーのセットアップ手順

## 📋 概要

アットホームスクレイピング自動入力機能を本番環境で動作させるには、スクレイピングサーバーをRailwayにデプロイし、フロントエンドの環境変数を設定する必要があります。

---

## ✅ 前提条件

- Railwayアカウントを持っている
- `scrape-server/` ディレクトリが存在する
- Gitリポジトリにプッシュ済み

---

## 🚀 ステップ1: Railwayにスクレイピングサーバーをデプロイ

### 1-1. Railwayプロジェクトを作成

1. https://railway.app/ にアクセス
2. 「New Project」をクリック
3. 「Deploy from GitHub repo」を選択
4. `sateituikyaku-admin` リポジトリを選択
5. プロジェクト名を入力: `scrape-server`

### 1-2. ルートディレクトリを設定

1. プロジェクト設定を開く
2. 「Settings」タブを開く
3. 「Root Directory」を `scrape-server` に設定
4. 「Save」をクリック

### 1-3. 環境変数を設定

1. 「Variables」タブを開く
2. 以下の環境変数を追加:

| 変数名 | 値 | 説明 |
|-------|---|------|
| `SUPABASE_URL` | `https://krxhrbtlgfjzsseegaqq.supabase.co` | SupabaseのURL |
| `SUPABASE_SERVICE_KEY` | （Supabaseのサービスキー） | Supabaseのサービスキー |
| `PORT` | `8765` | ポート番号 |

**SUPABASE_SERVICE_KEYの取得方法**:
1. https://supabase.com/dashboard にアクセス
2. プロジェクト `krxhrbtlgfjzsseegaqq` を開く
3. 「Settings」→「API」を開く
4. 「service_role」キーをコピー

### 1-4. デプロイを確認

1. 「Deployments」タブを開く
2. 最新のデプロイが「Success」になっているか確認
3. ログにエラーがないか確認

### 1-5. 公開URLを取得

1. 「Settings」タブを開く
2. 「Networking」セクションを開く
3. 「Generate Domain」をクリック
4. 生成されたURLをコピー
   - 例: `https://scrape-server-production-XXXX.up.railway.app`

### 1-6. ヘルスチェック

ブラウザで以下のURLにアクセス:
```
https://scrape-server-production-XXXX.up.railway.app/health
```

**期待されるレスポンス**:
```json
{"status": "ok"}
```

---

## 🔧 ステップ2: フロントエンドの環境変数を設定

### 2-1. ローカルの環境変数ファイルを更新

`frontend/frontend/.env.production` に以下を追加:

```env
VITE_SCRAPE_API_URL=https://scrape-server-production-XXXX.up.railway.app
```

**注意**: `XXXX` の部分は実際のRailway URLに置き換えてください。

### 2-2. Vercelの環境変数を設定

1. https://vercel.com/ にアクセス
2. `sateituikyaku-admin-frontend` プロジェクトを開く
3. 「Settings」→「Environment Variables」を開く
4. 以下の環境変数を追加:

| 変数名 | 値 | 環境 |
|-------|---|------|
| `VITE_SCRAPE_API_URL` | `https://scrape-server-production-XXXX.up.railway.app` | Production |

5. 「Save」をクリック

### 2-3. Vercelを再デプロイ

環境変数を追加した後、Vercelを再デプロイする必要があります。

**方法1: Vercelダッシュボードから**
1. 「Deployments」タブを開く
2. 最新のデプロイの「...」メニューをクリック
3. 「Redeploy」をクリック

**方法2: Gitプッシュから**
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

---

## 🔍 ステップ3: 動作確認

### 3-1. 本番環境で確認

1. https://sateituikyaku-admin-frontend.vercel.app を開く
2. 買主リスト → 「他社物件新着配信」
3. URLを入力: `https://www.athome.co.jp/mansion/6990582043/`
4. 「物件情報を取得」ボタンをクリック
5. 自動入力が動作するか確認

### 3-2. 開発者ツールで確認

1. ブラウザの開発者ツールを開く（F12）
2. Networkタブを開く
3. 「物件情報を取得」ボタンをクリック
4. `/scrape` リクエストを確認
   - リクエストURL: `https://scrape-server-production-XXXX.up.railway.app/scrape`
   - ステータス: `200 OK`
   - レスポンス: `{"success": true, "data": {...}}`

---

## 🐛 トラブルシューティング

### 問題1: Railwayデプロイが失敗する

**エラー**: `Build failed`

**原因**: Dockerfileまたは依存関係の問題

**解決方法**:
1. Railwayのデプロイログを確認
2. `scrape-server/requirements.txt` を確認
3. `scrape-server/Dockerfile` を確認

### 問題2: ヘルスチェックが失敗する

**エラー**: `{"status": "ok"}` が返ってこない

**原因**: サーバーが起動していない

**解決方法**:
1. Railwayのログを確認
2. 環境変数が正しく設定されているか確認
3. ポート番号が `8765` になっているか確認

### 問題3: フロントエンドからスクレイピングサーバーにアクセスできない

**エラー**: `取得失敗: scrape_server.pyが起動しているか確認してください。`

**原因**: 環境変数が設定されていない、またはURLが間違っている

**解決方法**:
1. Vercelの環境変数を確認
   - `VITE_SCRAPE_API_URL` が設定されているか
   - URLが正しいか（`https://` で始まっているか）
2. Vercelを再デプロイ
3. ブラウザの開発者ツールでリクエストURLを確認

### 問題4: CORSエラーが発生する

**エラー**: `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**原因**: スクレイピングサーバーのCORS設定が間違っている

**解決方法**:
1. `scrape-server/scrape_server.py` の `_set_cors()` メソッドを確認
2. `Access-Control-Allow-Origin` が `*` になっているか確認
3. Railwayを再デプロイ

---

## 📝 環境変数一覧

### Railwayスクレイピングサーバー

| 変数名 | 値 | 必須 |
|-------|---|------|
| `SUPABASE_URL` | `https://krxhrbtlgfjzsseegaqq.supabase.co` | ✅ |
| `SUPABASE_SERVICE_KEY` | （Supabaseのサービスキー） | ✅ |
| `PORT` | `8765` | ⬜ |

### Vercelフロントエンド

| 変数名 | 値 | 必須 |
|-------|---|------|
| `VITE_SCRAPE_API_URL` | `https://scrape-server-production-XXXX.up.railway.app` | ✅ |

---

## 🎯 チェックリスト

デプロイが完了したら、以下をチェックしてください：

- [ ] Railwayプロジェクトを作成
- [ ] ルートディレクトリを `scrape-server` に設定
- [ ] 環境変数を設定（`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`）
- [ ] Railwayデプロイが成功
- [ ] 公開URLを取得
- [ ] ヘルスチェックが成功（`/health` が `{"status": "ok"}` を返す）
- [ ] フロントエンドの環境変数を設定（`VITE_SCRAPE_API_URL`）
- [ ] Vercelを再デプロイ
- [ ] 本番環境で動作確認
- [ ] 自動入力が正しく動作する

**すべてチェックが完了したら、セットアップ完了です！** ✅

---

## 📚 関連ドキュメント

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - デプロイチェックリスト
- [ATHOME_AUTO_FILL_FEATURE.md](./ATHOME_AUTO_FILL_FEATURE.md) - 機能の詳細ドキュメント
- [AUTO_FILL_IMPLEMENTATION_SUMMARY.md](./AUTO_FILL_IMPLEMENTATION_SUMMARY.md) - 実装報告書

---

**作成日**: 2026年5月5日  
**作成者**: KIRO  
**バージョン**: 1.0.0
