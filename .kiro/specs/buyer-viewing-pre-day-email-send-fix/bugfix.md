# バグ修正要求書：買主内覧前日メール送信エラー修正

## バグ情報

**バグID**: buyer-viewing-pre-day-email-send-fix  
**発見日**: 2026年4月3日  
**重要度**: 高（業務に直接影響）  
**影響範囲**: 買主内覧ページのメール送信機能

---

## バグの説明

### 現象

買主リストの内覧ページで「内覧前日Eメール」送信ボタンを押すと、以下のエラーが発生する：

```
Request failed with status code 500
```

**エラー発生画面**:
- テンプレート: ☆内覧前日通知メール
- 送信先: yui.keigo.0713@gmail.com
- 選択物件数: 1件

### 期待される動作

1. ユーザーが「内覧前日Eメール」ボタンをクリック
2. テンプレート「☆内覧前日通知メール」が自動選択される
3. メール作成モーダルが開く
4. ユーザーが内容を確認・編集して送信
5. メールが正常に送信される
6. 成功メッセージが表示される

### 実際の動作

1. ユーザーが「内覧前日Eメール」ボタンをクリック
2. テンプレート取得は成功
3. メール作成モーダルが開く
4. ユーザーが送信ボタンをクリック
5. **500エラーが発生**
6. メール送信失敗

---

## 再現手順

1. 買主リストページを開く
2. 内覧日が前日の買主を選択
3. 内覧ページを開く
4. 「内覧前日Eメール」ボタンをクリック
5. メール作成モーダルで内容を確認
6. 「送信」ボタンをクリック
7. **500エラーが発生**

---

## バグ条件 C(X)

**バグ条件**: 以下の条件を全て満たす場合、メール送信が500エラーで失敗する

```
C(X) = (
  X.endpoint === '/api/gmail/send' AND
  X.method === 'POST' AND
  X.buyerId !== null AND
  X.subject !== null AND
  X.body !== null AND
  X.senderEmail !== null AND
  X.response.status === 500
)
```

**入力ドメイン**:
- `X.endpoint`: APIエンドポイント（文字列）
- `X.method`: HTTPメソッド（文字列）
- `X.buyerId`: 買主ID（文字列）
- `X.subject`: メール件名（文字列）
- `X.body`: メール本文（文字列）
- `X.senderEmail`: 送信者メールアドレス（文字列）
- `X.response.status`: HTTPステータスコード（数値）

---

## 根本原因の仮説

### 仮説1: GoogleAuthServiceの認証エラー

**可能性**: 高

**理由**:
- `EmailService.sendBuyerEmail()` は `GoogleAuthService.getAuthenticatedClient()` を使用
- OAuth2トークンの有効期限切れ、またはリフレッシュトークンの問題
- 環境変数の設定ミス（`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`）

**確認方法**:
```bash
# バックエンドログを確認
# エラーメッセージに "authentication" や "token" が含まれているか確認
```

### 仮説2: Gmail APIのクォータ制限

**可能性**: 中

**理由**:
- Gmail APIの1日あたりの送信制限に達している
- レート制限（1秒あたりのリクエスト数）に達している

**確認方法**:
```bash
# Google Cloud Consoleでクォータ使用状況を確認
```

### 仮説3: メール本文のエンコーディングエラー

**可能性**: 中

**理由**:
- 日本語の件名・本文のBase64エンコーディングに失敗
- 特殊文字（絵文字など）が含まれている

**確認方法**:
```bash
# バックエンドログでエンコーディングエラーを確認
```

### 仮説4: 添付ファイルの処理エラー

**可能性**: 低

**理由**:
- 内覧前日メールには通常添付ファイルがない
- ただし、`attachments` パラメータの処理でエラーが発生している可能性

---

## 影響範囲

### 影響を受ける機能

1. **買主内覧前日メール送信**（最も影響大）
   - ファイル: `frontend/frontend/src/components/PreDayEmailButton.tsx`
   - エンドポイント: `/api/gmail/send`

2. **買主へのメール送信全般**（潜在的影響）
   - 同じ `/api/gmail/send` エンドポイントを使用する他の機能も影響を受ける可能性

### 影響を受けないもの

- 売主へのメール送信（別のエンドポイント `/api/sellers/:id/send-valuation-email` を使用）
- 物件配信メール（別のエンドポイント `/api/property-listings/:propertyNumber/send-distribution-emails` を使用）

---

## 修正の方向性

### 優先度1: エラーログの詳細化

**目的**: 根本原因を特定するため、詳細なエラーログを追加

**実装箇所**:
- `backend/src/routes/gmail.ts` の `/send` エンドポイント
- `backend/src/services/EmailService.ts` の `sendBuyerEmail()` メソッド
- `backend/src/services/GoogleAuthService.ts` の `getAuthenticatedClient()` メソッド

**追加するログ**:
```typescript
// gmail.ts
console.error('[gmail/send] 詳細エラー:', {
  buyerId,
  subject,
  bodyLength: bodyText.length,
  senderEmail,
  errorMessage: error.message,
  errorStack: error.stack,
});

// EmailService.ts
console.error('[EmailService] sendBuyerEmail エラー:', {
  to: params.to,
  subject: params.subject,
  bodyLength: params.body.length,
  attachmentsCount: params.attachments?.length || 0,
  errorMessage: error.message,
  errorStack: error.stack,
});

// GoogleAuthService.ts
console.error('[GoogleAuthService] 認証エラー:', {
  errorMessage: error.message,
  errorStack: error.stack,
});
```

### 優先度2: 環境変数の確認

**確認項目**:
```bash
# Vercelの環境変数を確認
GOOGLE_CLIENT_ID=<設定されているか>
GOOGLE_CLIENT_SECRET=<設定されているか>
GOOGLE_REFRESH_TOKEN=<設定されているか>
SUPABASE_URL=<設定されているか>
SUPABASE_SERVICE_ROLE_KEY=<設定されているか>
```

### 優先度3: エラーハンドリングの改善

**目的**: ユーザーに分かりやすいエラーメッセージを表示

**実装箇所**:
- `backend/src/routes/gmail.ts` の `/send` エンドポイント

**改善内容**:
```typescript
// 現在
res.status(500).json({ error: 'メール送信に失敗しました' });

// 改善後
res.status(500).json({ 
  error: 'メール送信に失敗しました',
  details: error.message, // 開発環境のみ
  code: 'EMAIL_SEND_ERROR',
});
```

---

## テスト計画

### 探索テスト（Bug Condition Exploration Test）

**目的**: バグ条件 C(X) を満たす入力を見つける

**テストケース**:

1. **正常系テスト**
   - 買主ID: 有効なID
   - 件名: 「大分市大在北4-9-20の内覧のご連絡（株式会社いふぅ）」
   - 本文: 正常な日本語テキスト
   - 送信者: 有効なメールアドレス
   - **期待結果**: 200 OK

2. **認証エラーテスト**
   - 環境変数 `GOOGLE_REFRESH_TOKEN` を無効な値に設定
   - **期待結果**: 500エラー（認証エラー）

3. **クォータ制限テスト**
   - 短時間に大量のメール送信リクエストを送信
   - **期待結果**: 429エラー（レート制限）または500エラー

4. **エンコーディングエラーテスト**
   - 件名・本文に特殊文字（絵文字など）を含める
   - **期待結果**: 200 OK または 500エラー

### 修正検証テスト（Fix Verification Test）

**目的**: 修正後、バグ条件 C(X) を満たす入力でもエラーが発生しないことを確認

**テストケース**:

1. **修正後の正常系テスト**
   - 探索テストで見つかったバグ条件を満たす入力
   - **期待結果**: 200 OK（エラーが発生しない）

2. **エラーログの確認**
   - 修正後、詳細なエラーログが出力されることを確認
   - **期待結果**: エラーログに根本原因が記録される

---

## 成功基準

### 必須条件

1. ✅ 買主内覧前日メール送信が正常に動作する
2. ✅ 500エラーが発生しない
3. ✅ 詳細なエラーログが出力される（エラー発生時）
4. ✅ ユーザーに分かりやすいエラーメッセージが表示される

### 望ましい条件

1. ✅ 根本原因が特定される
2. ✅ 同じエラーが再発しないように予防策が実装される
3. ✅ エラーハンドリングが改善される

---

## 関連ファイル

### フロントエンド

- `frontend/frontend/src/components/PreDayEmailButton.tsx` - 内覧前日メール送信ボタン
- `frontend/frontend/src/components/BuyerEmailCompositionModal.tsx` - メール作成モーダル
- `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` - 買主内覧ページ

### バックエンド

- `backend/src/routes/gmail.ts` - Gmail送信エンドポイント
- `backend/src/services/EmailService.ts` - メール送信サービス
- `backend/src/services/GoogleAuthService.ts` - Google認証サービス
- `backend/src/services/EmailHistoryService.ts` - メール履歴サービス
- `backend/src/services/ActivityLogService.ts` - アクティビティログサービス

---

## 備考

- このバグは業務に直接影響するため、優先度が高い
- 根本原因を特定するため、まず詳細なエラーログを追加する
- エラーログを確認してから、具体的な修正を実施する

---

**作成日**: 2026年4月3日  
**作成者**: Kiro AI  
**最終更新日**: 2026年4月3日
