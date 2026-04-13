# バグ修正要件ドキュメント

## はじめに

買主リストの内覧ページで「☆内覧前日通知メール」テンプレートを使ってメール送信しようとすると、バックエンドが500 Internal Server Errorを返すバグ。メール送信モーダルは正常に表示され、件名・本文も正しく生成されているにもかかわらず、送信ボタンを押すと `AxiosError: Request failed with status code 500` が発生する。

- 対象エンドポイント: `POST /api/gmail/send`
- 対象コンポーネント: `PreDayEmailButton.tsx` → `backend/src/routes/gmail.ts`
- 送信先: tomoko.kunihiro@ifoo-oita.com
- テンプレート: ☆内覧前日通知メール

過去の調査（`buyer-viewing-pre-day-email-send-fix`スペック）により、このバグの根本原因は **OAuth2リフレッシュトークンの無効化**（`invalid_grant`エラー）であることが確認されている。`GoogleAuthService`が使用する会社アカウント（`tenant@ifoo-oita.com`）のOAuth2リフレッシュトークンが無効化されると、Gmail送信とGoogleカレンダー連携の両方が動作しなくなる。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 買主リストの内覧ページで「☆内覧前日通知メール」の送信ボタンを押す THEN システムは500 Internal Server Errorを返す

1.2 WHEN `POST /api/gmail/send` に有効なパラメータ（buyerId、subject、body、senderEmail）を送信する THEN システムはメール送信処理に失敗してエラーレスポンスを返す

1.3 WHEN `EmailService.sendBuyerEmail` が `GoogleAuthService.getAuthenticatedClient()` を呼び出す THEN システムはOAuth2リフレッシュトークンの無効化（`invalid_grant`）によりGoogle認証に失敗する

1.4 WHEN `getAuthenticatedClient()` が `client.refreshAccessToken()` を呼び出す THEN システムは `invalid_grant` エラーをスローし、`GOOGLE_AUTH_REQUIRED` エラーが発生する

### 期待される動作（正常）

2.1 WHEN 買主リストの内覧ページで「☆内覧前日通知メール」の送信ボタンを押す THEN システムは SHALL メールを正常に送信して成功レスポンスを返す

2.2 WHEN `POST /api/gmail/send` に有効なパラメータを送信する THEN システムは SHALL Gmail APIを通じてメールを送信し `{ success: true }` を返す

2.3 WHEN `GoogleAuthService.getAuthenticatedClient()` が呼び出される THEN システムは SHALL 有効なOAuth2クライアントを返してGmail APIへのアクセスを許可する

2.4 WHEN メール送信が成功する THEN システムは SHALL `email_history` テーブルと `activity_logs` テーブルに記録する

### 変更されない動作（リグレッション防止）

3.1 WHEN 内覧前日通知メール以外のメール送信機能（売主メール、物件配信メール等）を使用する THEN システムは SHALL CONTINUE TO 正常にメールを送信する

3.2 WHEN メール本文プレビューを表示する THEN システムは SHALL CONTINUE TO 日付・時間・住所を正しく表示する

3.3 WHEN `mergeMultiple` エンドポイントを呼び出す THEN システムは SHALL CONTINUE TO テンプレートのプレースホルダーを正しく置換する

3.4 WHEN 買主情報を取得する THEN システムは SHALL CONTINUE TO `buyer_number` でも `buyer_id` でも正しく検索できる

3.5 WHEN Googleカレンダー連携機能を使用する THEN システムは SHALL CONTINUE TO カレンダーイベントを正常に作成できる
