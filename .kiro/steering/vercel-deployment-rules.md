---
inclusion: manual
---

# Vercelデプロイルール（絶対に守るべきルール）

## ⚠️ 最重要：正しいプロジェクトのみデプロイする

このリポジトリには**3つのVercelプロジェクト**があります：

### ✅ 使用するプロジェクト（デプロイOK）

1. **`sateituikyaku-admin-backend`** （バックエンド）
   - ディレクトリ: `backend/`
   - デプロイ方法: Gitプッシュで自動デプロイ
   - 手動デプロイ: ルートディレクトリから`vercel --prod --force`

2. **`sateituikyaku-admin-frontend`** （フロントエンド）
   - ディレクトリ: `frontend/frontend/`
   - デプロイ方法: Gitプッシュで自動デプロイ
   - 手動デプロイ: `frontend/`ディレクトリから`vercel --prod --force`

### ❌ 使用しないプロジェクト（デプロイ禁止）

3. **`frontend`** （古いプロジェクト・使用禁止）
   - このプロジェクトは削除するか、無効化する
   - 絶対にデプロイしない

---

## 🚨 デプロイ前の必須チェックリスト

デプロイする前に、以下を必ず確認してください：

- [ ] デプロイするプロジェクト名を確認したか？
  - ✅ `sateituikyaku-admin-backend` または `sateituikyaku-admin-frontend`
  - ❌ `frontend`（これは使用禁止）

- [ ] 正しいディレクトリから実行しているか？
  - バックエンド: ルートディレクトリ
  - フロントエンド: `frontend/`ディレクトリ

- [ ] Vercelダッシュボードで正しいプロジェクトがデプロイされているか確認したか？

---

## ✅ 正しいデプロイ方法

### 方法1: Gitプッシュで自動デプロイ（推奨）

```bash
# 変更をコミット
git add .
git commit -m "feat: description"
git push

# Vercel GitHubインテグレーションが自動的にデプロイ
# - backend/ の変更 → sateituikyaku-admin-backend をデプロイ
# - frontend/frontend/ の変更 → sateituikyaku-admin-frontend をデプロイ
```

### 方法2: 手動デプロイ（緊急時のみ）

**バックエンド**:
```bash
# ルートディレクトリから実行
cd C:\Users\kunih\sateituikyaku-admin
vercel --prod --force
```

**フロントエンド**:
```bash
# frontend/ディレクトリから実行
cd C:\Users\kunih\sateituikyaku-admin\frontend
vercel --prod --force
```

---

## ❌ 間違ったデプロイ方法（絶対にやらない）

### 間違い1: 「frontend」プロジェクトをデプロイ

```bash
❌ vercel --prod --force  # frontendプロジェクトがデプロイされる
```

**解決策**: Vercelダッシュボードで「frontend」プロジェクトを削除する

### 間違い2: 間違ったディレクトリから実行

```bash
❌ cd backend
❌ vercel --prod --force  # パスエラーが発生
```

**解決策**: ルートディレクトリから実行する

---

## 🔧 Vercelプロジェクト設定の確認方法

### バックエンド設定

```bash
cat backend/.vercel/project.json
```

**期待される内容**:
```json
{
  "projectName": "sateituikyaku-admin-backend",
  "settings": {
    "rootDirectory": "backend"
  }
}
```

### フロントエンド設定

```bash
cat frontend/.vercel/project.json
```

**期待される内容**:
```json
{
  "projectName": "sateituikyaku-admin-frontend",
  "settings": {
    "rootDirectory": "frontend/frontend"
  }
}
```

---

## 🚨 トラブルシューティング

### 問題1: 「frontend」プロジェクトが勝手にデプロイされる

**原因**: Vercel GitHubインテグレーションが「frontend」プロジェクトを監視している

**解決策**:
1. Vercelダッシュボード → 「frontend」プロジェクト → Settings → Git → Disconnect
2. または、プロジェクトを削除: Settings → Advanced → Delete Project

### 問題2: パスエラー（`backend\backend`など）

**原因**: Vercel CLIが`rootDirectory`設定を二重に適用している

**解決策**: ルートディレクトリから実行する

---

## 📋 まとめ

**デプロイする前に必ず確認**:
1. プロジェクト名が`sateituikyaku-admin-backend`または`sateituikyaku-admin-frontend`か？
2. 「frontend」プロジェクトではないか？
3. 正しいディレクトリから実行しているか？

**推奨デプロイ方法**:
- Gitプッシュで自動デプロイ（最も安全）

**最終更新日**: 2026年4月8日  
**作成理由**: 間違った「frontend」プロジェクトがデプロイされる問題を防ぐため
