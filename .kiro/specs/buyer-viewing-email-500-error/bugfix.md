# バグ修正要件ドキュメント

## はじめに

買主リストの内覧前日通知メール（テンプレート: ☆内覧前日通知メール）を送信しようとすると、バックエンドが500 Internal Server Errorを返すバグ。フロントエンドのメール本文プレビューには日付・場所が正しく表示されているにもかかわらず、送信ボタンを押すと `AxiosError: Request failed with status code 500` が発生する。

対象エンドポイント: `POST /api/gmail/send`
対象コンポーネント: `PreDayEmailButton.tsx` → `backend/src/routes/gmail.ts`

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 買主リストの内覧前日通知メール送信ボタンを押す THEN システムは500 Internal Server Errorを返す

1.2 WHEN `POST /api/gmail/send` に `{ buyerId, propertyIds, senderEmail, subject, body }` を送信する THEN システムはメール送信処理に失敗してエラーレスポンスを返す

1.3 WHEN `EmailService.sendBuyerEmail` が `GoogleAuthService.getAuthenticatedClient()` を呼び出す THEN システムはGoogle認証またはGmail API呼び出しに失敗する可能性がある

1.4 WHEN `gmail.ts` の `send` エンドポイントで `result.success === false` になる THEN システムは `res.status(500)` を返す

### 期待される動作（正常）

2.1 WHEN 買主リストの内覧前日通知メール送信ボタンを押す THEN システムはSHALL メールを正常に送信して成功レスポンスを返す

2.2 WHEN `POST /api/gmail/send` に有効なパラメータを送信する THEN システムはSHALL Gmail APIを通じてメールを送信し `{ success: true }` を返す

2.3 WHEN `EmailService.sendBuyerEmail` が呼び出される THEN システムはSHALL Google認証を正常に取得してメールを送信する

2.4 WHEN メール送信が成功する THEN システムはSHALL `email_history` テーブルと `activity_logs` テーブルに記録する

### 変更されない動作（リグレッション防止）

3.1 WHEN 内覧前日通知メール以外のメール送信機能を使用する THEN システムはSHALL CONTINUE TO 正常にメールを送信する

3.2 WHEN メール本文プレビューを表示する THEN システムはSHALL CONTINUE TO 日付・時間・住所を正しく表示する

3.3 WHEN `mergeMultiple` エンドポイントを呼び出す THEN システムはSHALL CONTINUE TO テンプレートのプレースホルダーを正しく置換する

3.4 WHEN 買主情報を取得する THEN システムはSHALL CONTINUE TO `buyer_number` でも `buyer_id` でも正しく検索できる
