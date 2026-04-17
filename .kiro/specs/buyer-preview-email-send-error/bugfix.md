# バグ修正要件書

## Introduction

買主リストの「内覧前日メール」テンプレートをEmailボタンからクリックして送信すると「送れませんでした」エラーが断続的に発生するバグ。
HTTPステータスコード500が返され、時間をおいて再送信すると成功することから、一時的な状態に依存した断続的な失敗であることが示唆される。

送信フローは以下の通り：
1. `PreDayEmailButton` の「内覧前日Eメール」ボタンをクリック
2. `/api/email-templates` からテンプレート一覧を取得し「☆内覧前日通知メール」を選択
3. `/api/email-templates/{id}/mergeMultiple` でテンプレートをマージ
4. メール作成モーダルで確認 → `POST /api/gmail/send` でメール送信
5. バックエンドの `EmailService.sendBuyerEmail` → `GoogleAuthService.getAuthenticatedClient()` でGmail API認証クライアントを取得
6. `getAuthenticatedClient()` は毎回 `refreshAccessToken()` を呼び出してアクセストークンを更新する

`getAuthenticatedClient()` が呼ばれるたびに `client.refreshAccessToken()` を実行しており、Google APIの一時的な遅延・レート制限・ネットワーク問題が発生した際にそのまま500エラーとして失敗する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストの「内覧前日メール」テンプレートを選択してEmailボタンから送信する際に、`GoogleAuthService.getAuthenticatedClient()` 内の `refreshAccessToken()` がGoogle APIの一時的な問題（レート制限・ネットワーク遅延・タイムアウト等）で失敗する場合 THEN システムはHTTPステータス500を返し「送れませんでした」エラーを表示してメール送信が失敗する

1.2 WHEN 上記の失敗が発生した直後に再送信を試みる場合 THEN システムは同様のエラーを返す可能性があるが、時間をあけると成功する（一時的な状態依存の断続的エラー）

1.3 WHEN `getAuthenticatedClient()` が毎回 `refreshAccessToken()` を呼び出す場合 THEN トークン取得処理にはリトライロジックが適用されておらず、一時的な失敗がそのまま500エラーとして伝播する

### Expected Behavior (Correct)

2.1 WHEN 買主リストの「内覧前日メール」テンプレートを選択してEmailボタンから送信する際に、`refreshAccessToken()` が一時的な問題で失敗する場合 THEN システムはリトライを行い、一時的な失敗を自動的に回復してメール送信を完了するべきである

2.2 WHEN トークン取得が一時的な失敗後にリトライで成功する場合 THEN システムはメール送信を正常に完了し、ユーザーに成功メッセージを表示するべきである

2.3 WHEN リトライを繰り返しても最終的にトークン取得が失敗する場合 THEN システムは明確なエラーメッセージを表示するべきである

### Unchanged Behavior (Regression Prevention)

3.1 WHEN メール送信自体（Gmail API `messages.send`）が一時的に失敗する場合 THEN システムは引き続き既存のリトライロジックによるリトライを行う

3.2 WHEN 「内覧前日メール」以外のテンプレートを使用してEmail送信ボタンから送信する場合 THEN システムは引き続き正常に動作する

3.3 WHEN メール送信が成功する場合 THEN システムは引き続き `email_history` と `activity_logs` への記録を行う

3.4 WHEN カレンダー送信など他のGoogle API機能を使用する場合 THEN システムは引き続き正常に動作する

---

## Bug Condition（バグ条件の定式化）

### Bug Condition Function

```pascal
FUNCTION isBugCondition(sendRequest)
  INPUT: sendRequest（メール送信リクエスト）
  OUTPUT: boolean

  // GoogleAuthService.getAuthenticatedClient() が
  // refreshAccessToken() の一時的な失敗で例外をスローする状態
  tokenRefreshFails ← refreshAccessToken() が一時的なエラーを返す
                      （レート制限・ネットワーク遅延・タイムアウト等）

  RETURN tokenRefreshFails
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - トークン取得失敗時のリトライ
FOR ALL sendRequest WHERE isBugCondition(sendRequest) DO
  result ← sendBuyerEmail'(sendRequest)
  // 一時的な失敗はリトライで回復し、最終的に成功する
  ASSERT result.success = true OR result.error が明確なエラーメッセージを含む
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking
FOR ALL sendRequest WHERE NOT isBugCondition(sendRequest) DO
  ASSERT sendBuyerEmail(sendRequest) = sendBuyerEmail'(sendRequest)
END FOR
```
