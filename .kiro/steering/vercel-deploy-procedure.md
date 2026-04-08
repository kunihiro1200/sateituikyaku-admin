---
inclusion: manual
---

# Vercelデプロイ手順

## ⚠️ 重要：正しいプロジェクトのみデプロイする

このプロジェクトには複数のVercelプロジェクトが存在しますが、**デプロイすべきプロジェクトは限定されています**。

---

## ✅ デプロイ対象プロジェクト

### 1. バックエンド（sateituikyaku-admin-backend）

**ディレクトリ**: `backend/`

**デプロイコマンド**:
```bash
cd backend
vercel --prod
```

**Vercelプロジェクト名**: `sateituikyaku-admin-backend`

**URL**: https://sateituikyaku-admin-backend.vercel.app

---

### 2. フロントエンド（sateituikyaku-admin-frontend）

**ディレクトリ**: `frontend/frontend/`

**デプロイコマンド**:
```bash
cd frontend/frontend
vercel --prod
```

**Vercelプロジェクト名**: `sateituikyaku-admin-frontend`

**URL**: https://sateituikyaku-admin-frontend.vercel.app

---

## ❌ デプロイしてはいけないプロジェクト

以下のディレクトリは**このプロジェクトとは関係ない**ため、デプロイしないでください：

- ❌ `backend/api/` - 公開物件サイト用バックエンド（別プロジェクト）
- ❌ その他のディレクトリ

---

## 📋 デプロイ前のチェックリスト

デプロイする前に、以下を確認してください：

- [ ] 変更したファイルがどのプロジェクトに属するか確認
- [ ] `backend/src/` または `frontend/frontend/src/` のファイルを変更した場合のみデプロイ
- [ ] `backend/api/` のファイルを変更した場合はデプロイしない
- [ ] 正しいディレクトリ（`backend/` または `frontend/frontend/`）でデプロイコマンドを実行

---

## 🎯 デプロイ判断フロー

```
変更したファイルのパスを確認
  ↓
backend/src/ 配下？
  → YES: cd backend && vercel --prod
  → NO: 次へ
  ↓
frontend/frontend/src/ 配下？
  → YES: cd frontend/frontend && vercel --prod
  → NO: デプロイ不要
```

---

## 💡 ヒント

- **バックエンドのみ変更**: `backend/` ディレクトリでデプロイ
- **フロントエンドのみ変更**: `frontend/frontend/` ディレクトリでデプロイ
- **両方変更**: 両方のディレクトリでデプロイ
- **`backend/api/` を変更**: デプロイしない（別プロジェクト）

---

**最終更新日**: 2026年4月8日
**作成理由**: 誤ったプロジェクトをデプロイしないようにするため
