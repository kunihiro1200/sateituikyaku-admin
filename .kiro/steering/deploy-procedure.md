---
inclusion: manual
---

# デプロイ手順（絶対に守るべきルール）

## ✅ 正しいデプロイ手順（フロントエンド・バックエンド共通）

**Git連携によりpushするだけで両方が自動デプロイされます。**

```powershell
git add .
git commit -m "fix: 変更内容"
git push origin main
```

- `sateituikyaku-admin-backend`（バックエンド）→ Root Directory: `backend`
- `sateituikyaku-admin-frontend`（フロントエンド）→ Root Directory: `frontend/frontend`

どちらもGit連携済みのため、`main` ブランチへのpushで自動デプロイされます。

---

## 🚨 CLIデプロイ（npx vercel --prod）は使わない

`npx vercel --prod` をサブディレクトリから実行するとパスの二重解釈エラーが発生するため、
**原則としてCLIデプロイは使用しない**。

---

**最終更新日**: 2026年3月23日
**作成理由**: git pushによる自動デプロイに統一するため
