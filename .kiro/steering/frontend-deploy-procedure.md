# フロントエンドデプロイ手順（絶対に守るべきルール）

## ⚠️ 最重要：正しいデプロイ手順

### プロジェクト構造

```
C:\Users\kunih\sateituikyaku-admin\
  frontend\
    frontend\   ← ✅ 実際のフロントエンドコードはここ（src/, dist/ 等）
      src\
      dist\
      package.json
      vite.config.ts
      .vercel\project.json  ← sateituikyaku-admin-frontend を指している
```

### Vercelプロジェクト設定

| 項目 | 値 |
|------|-----|
| **プロジェクト名** | `sateituikyaku-admin-frontend` |
| **Root Directory** | **空欄**（絶対に変更しない） |
| **デプロイ実行場所** | `C:\Users\kunih\sateituikyaku-admin\frontend\frontend` |

---

## ✅ 正しいデプロイ手順

```powershell
# 1. frontend/frontend ディレクトリに移動
cd C:\Users\kunih\sateituikyaku-admin\frontend\frontend

# 2. デプロイ実行
npx vercel --prod
```

**これだけ。** Root Directory は空欄のまま、`frontend\frontend` から実行する。

---

## 🚨 絶対にやってはいけないこと

### ❌ Vercel Root Directory を変更しない

```
❌ Root Directory = "frontend/frontend"  ← 絶対ダメ
❌ Root Directory = "frontend"           ← 絶対ダメ
✅ Root Directory = 空欄                 ← これが正解
```

**理由**: Root Directory を設定すると、Vercelが「現在地 + Root Directory」でパスを二重に解釈してしまい、存在しないパスを探してエラーになる。

### ❌ frontend ディレクトリから実行しない

```powershell
# ❌ 間違い（frontend から実行）
cd C:\Users\kunih\sateituikyaku-admin\frontend
npx vercel --prod  # → 古いコードがデプロイされる

# ✅ 正しい（frontend\frontend から実行）
cd C:\Users\kunih\sateituikyaku-admin\frontend\frontend
npx vercel --prod
```

---

## 🔍 過去の失敗事例（2026年3月）

**問題**: デプロイ後にイメージカラー・サイドバーカテゴリー等が古い状態に戻った

**原因**:
1. `frontend\` ディレクトリから `npx vercel --prod` を実行してしまった
2. `frontend\` 直下には古いコードがあり、それがデプロイされた
3. 実際の最新コードは `frontend\frontend\` にある

**解決策**:
- Vercel Root Directory を空欄に戻す
- `frontend\frontend\` から `npx vercel --prod` を実行

---

## 📋 デプロイ前チェックリスト

- [ ] PowerShellのカレントディレクトリが `frontend\frontend` になっているか？
- [ ] Vercel Root Directory が空欄になっているか？
- [ ] `frontend\frontend\.vercel\project.json` が `sateituikyaku-admin-frontend` を指しているか？

---

**最終更新日**: 2026年3月23日
**作成理由**: Root Directory の誤設定により古いコードがデプロイされた問題の再発防止
