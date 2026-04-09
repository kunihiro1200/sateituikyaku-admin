# 買主メールアドレス検索機能 - デプロイ確認ガイド

## デプロイ状況

### ✅ 完了した作業

1. **コード実装**: `backend/src/services/BuyerService.ts`にメールアドレス検索機能を追加
2. **Gitコミット**: コミットID `4ce5983e`
3. **Gitプッシュ**: `origin/main`にプッシュ完了
4. **Vercel自動デプロイ**: プッシュ後、Vercelが自動的にデプロイを開始

### 📋 デプロイ情報

- **Vercelプロジェクト名**: `sateituikyaku-admin-backend`
- **本番URL**: https://sateituikyaku-admin-backend.vercel.app
- **コミットメッセージ**: "feat: 買主検索にメールアドレス検索機能を追加"

---

## 🔍 デプロイ完了の確認方法

### 方法1: Vercelダッシュボードで確認（推奨）

1. **Vercelダッシュボードを開く**:
   ```
   https://vercel.com/kunihiro1200s-projects/sateituikyaku-admin-backend/deployments
   ```

2. **最新のデプロイメントを確認**:
   - 最新のデプロイメント（コミット `4ce5983e`）が表示されているか確認
   - ステータスが「Ready」になっているか確認
   - デプロイ時間は通常1-3分程度

3. **デプロイログを確認**:
   - デプロイメントをクリック
   - 「Building」タブでビルドログを確認
   - エラーがないか確認

---

### 方法2: フロントエンドで動作確認（最も確実）

デプロイが完了したら、実際にフロントエンドの買主リスト画面で検索機能をテストします。

#### ステップ1: 買主リスト画面を開く

```
https://sateituikyaku-admin-frontend.vercel.app/buyers
```

#### ステップ2: 検索バーでメールアドレスを検索

1. **ドメイン名で検索**:
   - 検索バーに `gmail.com` と入力
   - Enterキーを押す
   - メールアドレスに `gmail.com` を含む買主が表示されることを確認

2. **メールアドレスの一部で検索**:
   - 検索バーに `test` と入力
   - Enterキーを押す
   - メールアドレスに `test` を含む買主が表示されることを確認

3. **完全なメールアドレスで検索**:
   - 検索バーに完全なメールアドレス（例: `test@example.com`）を入力
   - Enterキーを押す
   - 該当する買主が表示されることを確認

#### ステップ3: 既存の検索機能が正常に動作することを確認

1. **買主番号で検索**:
   - 検索バーに買主番号（例: `5641`）を入力
   - 該当する買主が表示されることを確認

2. **名前で検索**:
   - 検索バーに名前（例: `山田`）を入力
   - 該当する買主が表示されることを確認

3. **電話番号で検索**:
   - 検索バーに電話番号の一部（例: `090`）を入力
   - 該当する買主が表示されることを確認

---

### 方法3: ブラウザの開発者ツールで確認

1. **買主リスト画面を開く**:
   ```
   https://sateituikyaku-admin-frontend.vercel.app/buyers
   ```

2. **開発者ツールを開く**:
   - F12キーを押す
   - 「Network」タブを選択

3. **メールアドレスで検索**:
   - 検索バーに `gmail.com` と入力
   - Enterキーを押す

4. **APIリクエストを確認**:
   - Networkタブで `/api/buyers/search?q=gmail.com` のようなリクエストを探す
   - リクエストをクリック
   - 「Response」タブでレスポンスを確認
   - メールアドレスに `gmail.com` を含む買主が返されていることを確認

---

## ✅ 期待される動作

### メールアドレス検索

- ✅ メールアドレスの一部（ドメイン名）で検索できる
- ✅ メールアドレスの一部（ユーザー名）で検索できる
- ✅ 完全なメールアドレスで検索できる
- ✅ 大文字小文字を区別しない（`Gmail.com` でも `gmail.com` でも同じ結果）

### 既存機能の維持

- ✅ 買主番号検索が正常に動作する
- ✅ 名前検索が正常に動作する
- ✅ 電話番号検索が正常に動作する
- ✅ 物件番号検索が正常に動作する

---

## 🚨 トラブルシューティング

### 問題1: デプロイが失敗する

**症状**: Vercelダッシュボードでデプロイが「Error」になっている

**確認事項**:
1. ビルドログでエラーメッセージを確認
2. TypeScriptのコンパイルエラーがないか確認
3. 環境変数が正しく設定されているか確認

**解決策**:
```bash
# ローカルでビルドテスト
cd backend
npm run build
```

---

### 問題2: メールアドレス検索が動作しない

**症状**: 検索バーにメールアドレスを入力しても結果が表示されない

**確認事項**:
1. Vercelダッシュボードでデプロイが「Ready」になっているか確認
2. ブラウザのキャッシュをクリア（Ctrl + Shift + Delete）
3. 開発者ツールのNetworkタブでAPIレスポンスを確認

**解決策**:
- デプロイが完了するまで待つ（通常1-3分）
- ブラウザをリロード（Ctrl + F5）

---

### 問題3: 既存の検索機能が動作しない

**症状**: 買主番号や名前で検索できなくなった

**原因**: コードに問題がある可能性

**解決策**:
1. Gitで前のコミットに戻す
2. コードを修正して再デプロイ

```bash
# 前のコミットに戻す
git revert 4ce5983e
git push origin main
```

---

## 📝 実装内容の確認

### 変更されたファイル

- `backend/src/services/BuyerService.ts`

### 変更内容

#### 数字のみのクエリ（`isNumericOnly === true`）の場合

**変更前**:
```typescript
.or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`)
```

**変更後**:
```typescript
.or(`name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`)
```

#### 文字列を含むクエリ（`isNumericOnly === false`）の場合

**変更前**:
```typescript
.or(`buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,property_number.ilike.%${query}%`)
```

**変更後**:
```typescript
.or(`buyer_number.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%,property_number.ilike.%${query}%`)
```

---

## 📊 デプロイタイムライン

| 時刻 | イベント | 状態 |
|------|---------|------|
| - | コード実装完了 | ✅ |
| - | Gitコミット（`4ce5983e`） | ✅ |
| - | Gitプッシュ | ✅ |
| - | Vercel自動デプロイ開始 | 🔄 進行中 |
| +1-3分 | Vercel自動デプロイ完了 | ⏳ 待機中 |

---

## 次のステップ

1. **Vercelダッシュボードでデプロイ完了を確認**
2. **フロントエンドで動作確認**
3. **タスク4（本番環境で動作確認）に進む**

---

**作成日**: 2026年4月9日  
**タスク**: 3. Vercelにデプロイ  
**コミットID**: `4ce5983e`
