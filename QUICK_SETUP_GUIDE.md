# ⚡ クイックセットアップガイド

## 🎯 目的

アットホームスクレイピング自動入力機能を本番環境で動作させる

---

## 📋 必要な作業（5ステップ）

### ✅ ステップ1: Railwayにスクレイピングサーバーをデプロイ

1. https://railway.app/ にアクセス
2. 「New Project」→「Deploy from GitHub repo」
3. `sateituikyaku-admin` リポジトリを選択
4. 「Settings」→「Root Directory」を `scrape-server` に設定
5. 「Variables」で環境変数を設定:
   - `SUPABASE_URL`: `https://krxhrbtlgfjzsseegaqq.supabase.co`
   - `SUPABASE_SERVICE_KEY`: （Supabaseから取得）
6. 「Settings」→「Networking」→「Generate Domain」
7. 生成されたURLをコピー（例: `https://scrape-server-production-XXXX.up.railway.app`）

---

### ✅ ステップ2: ヘルスチェック

ブラウザで以下にアクセス:
```
https://scrape-server-production-XXXX.up.railway.app/health
```

**期待されるレスポンス**:
```json
{"status": "ok"}
```

---

### ✅ ステップ3: Vercelに環境変数を追加

1. https://vercel.com/ にアクセス
2. `sateituikyaku-admin-frontend` プロジェクトを開く
3. 「Settings」→「Environment Variables」
4. 追加:
   - 変数名: `VITE_SCRAPE_API_URL`
   - 値: `https://scrape-server-production-XXXX.up.railway.app`
   - 環境: `Production`
5. 「Save」

---

### ✅ ステップ4: Vercelを再デプロイ

**方法1**: Vercelダッシュボードから
- 「Deployments」→最新のデプロイの「...」→「Redeploy」

**方法2**: Gitプッシュから
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

---

### ✅ ステップ5: 動作確認

1. https://sateituikyaku-admin-frontend.vercel.app を開く
2. 買主リスト → 「他社物件新着配信」
3. URLを入力: `https://www.athome.co.jp/mansion/6990582043/`
4. 「物件情報を取得」ボタンをクリック
5. 以下が自動入力されることを確認:
   - ✅ 住所: `大分県大分市季の坂２丁目`
   - ✅ 価格帯: `2000万円以上`
   - ✅ 物件種別: `マンション`
   - ✅ P台数: `1台`

---

## 🎉 完了！

すべてのステップが完了したら、自動入力機能が本番環境で動作します。

---

## 🐛 エラーが出た場合

### エラー: `取得失敗: scrape_server.pyが起動しているか確認してください。`

**確認事項**:
1. Railwayのデプロイが成功しているか
2. ヘルスチェックが成功しているか（`/health` が `{"status": "ok"}` を返す）
3. Vercelの環境変数 `VITE_SCRAPE_API_URL` が設定されているか
4. Vercelを再デプロイしたか

**解決方法**: [SCRAPE_SERVER_SETUP.md](./SCRAPE_SERVER_SETUP.md) を参照

---

## 📚 詳細ドキュメント

- [SCRAPE_SERVER_SETUP.md](./SCRAPE_SERVER_SETUP.md) - 詳細なセットアップ手順
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - デプロイチェックリスト
- [ATHOME_AUTO_FILL_FEATURE.md](./ATHOME_AUTO_FILL_FEATURE.md) - 機能の詳細

---

**作成日**: 2026年5月5日  
**所要時間**: 約10分
