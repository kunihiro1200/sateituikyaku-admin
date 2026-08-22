# デプロイ手順

## ⚠️ 重要：ローカルでビルド・vercelコマンドを叩かないこと

`npm run build` や `vercel --prod` はローカルで実行しない。
**`git push` だけで GitHub Actions が自動でビルド＆デプロイする。**

---

## ✅ 正しいデプロイ手順（フロントエンド・バックエンド共通）

```bash
# 1. 変更ファイルをステージング（対象ファイルのみ指定する）
git add frontend/frontend/src/components/HogeComponent.tsx

# 2. コミット
git commit -m "fix: 変更内容の説明"

# 3. pushするだけ → GitHub Actions が自動デプロイ
git push origin main
```

これだけ。以上。

---

## 📋 GitHub Actions の動作

| 変更パス | トリガーされるワークフロー | デプロイ先 |
|---|---|---|
| `frontend/**` | `deploy-frontend.yml` | Vercel（フロントエンド） |
| `backend/**` | `deploy-backend.yml` | Vercel（バックエンド） |

- Actions の進捗は https://github.com/kunihiro1200/sateituikyaku-admin/actions で確認できる
- 通常 **3〜5分** でデプロイ完了

---

## ❌ やってはいけないこと

- `npm run build` をローカルで実行してからデプロイ → 時間の無駄
- `vercel --prod` をローカルで実行 → 37MBアップロードが発生して遅い
- `frontend/frontend` ディレクトリで `vercel` を実行 → パスが二重になりエラー

---

**最終更新日**: 2026年8月
