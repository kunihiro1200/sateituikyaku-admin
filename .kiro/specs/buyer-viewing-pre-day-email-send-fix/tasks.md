# 実装タスクリスト

## 1. バグ条件探索テスト（修正前）

- [x] 1. バグ条件探索テストを作成・実行
  - **Property 1: Bug Condition** - 買主内覧前日メール送信500エラー
  - **重要**: このテストは修正前のコードで実行し、バグを再現する
  - **目的**: 根本原因を特定し、仮説を検証または反証する
  - **スコープドPBTアプローチ**: 具体的な失敗ケース（会社アカウントトークン不在、OAuth2トークン有効期限切れ、環境変数未設定）をテスト
  - テスト内容:
    - 会社アカウントトークン不在テスト: `google_calendar_tokens`テーブルに会社アカウント（`tenant@ifoo-oita.com`）のトークンが存在しない状態でメール送信
    - OAuth2トークン有効期限切れテスト: リフレッシュトークンを無効化してメール送信
    - 環境変数未設定テスト: `GOOGLE_CALENDAR_CLIENT_ID`を削除してメール送信
    - Gmail APIクォータ制限テスト: 短時間に大量のメール送信リクエストを送信
  - 修正前のコードで実行
  - **期待される結果**: テストが失敗し、500エラーが発生する（これはバグの存在を確認するため正しい）
  - エラーログから根本原因を特定（`GOOGLE_AUTH_REQUIRED`、`invalid_grant`、`Google Calendar API is not configured`等）
  - 根本原因が仮説と一致するか確認
  - 一致しない場合は、新しい仮説を立てる
  - タスク完了条件: テストが作成され、実行され、根本原因が特定されたこと
  - _Requirements: 1.1（バグ再現）, 1.2（根本原因特定）_

## 2. 保存プロパティテスト（修正前）

- [x] 2. 保存プロパティテストを作成・実行（修正前）
  - **Property 2: Preservation** - 他のメール送信機能の保持
  - **重要**: 修正前のコードで実行し、既存機能が正常に動作することを確認
  - **目的**: 修正後も既存機能が保持されることを保証する
  - Property-based testingを使用して、多くのシナリオで既存機能が正常に動作することを検証
  - テスト内容:
    - 売主メール送信保持テスト: `/api/sellers/:id/send-valuation-email`エンドポイントが正常に動作することを確認
    - 物件配信メール保持テスト: `/api/property-listings/:propertyNumber/send-distribution-emails`エンドポイントが正常に動作することを確認
    - 他の買主機能保持テスト: 買主リスト表示、買主詳細表示が正常に動作することを確認
  - 修正前のコードで実行
  - **期待される結果**: テストが成功し、既存機能が正常に動作することを確認
  - タスク完了条件: テストが作成され、実行され、修正前のコードで成功したこと
  - _Requirements: 3.1（売主メール送信保持）, 3.2（物件配信メール保持）, 3.3（他機能への影響なし）_

## 3. バグ修正実装

- [x] 3. バグ修正を実装

  - [x] 3.1 Phase 1: エラーログの詳細化（優先度1）
    - `backend/src/routes/gmail.ts`の`POST /send`エンドポイントにエラーログを追加
    - `backend/src/services/EmailService.ts`の`sendBuyerEmail()`にエラーログを追加
    - `backend/src/services/GoogleAuthService.ts`の`getAuthenticatedClient()`にエラーログを追加
    - `backend/src/services/GoogleAuthService.ts`の`getAccessToken()`に会社アカウントトークン存在確認ログを追加
    - _Bug_Condition: isBugCondition(input) where input.endpoint = '/api/gmail/send' AND response.status = 500_
    - _Expected_Behavior: エラーログに詳細な情報（buyerId, subject, errorMessage, errorStack, errorCode）が記録される_
    - _Preservation: 他のメール送信機能（売主メール、物件配信メール）は影響を受けない_
    - _Requirements: 1.1（バグ再現）, 1.2（根本原因特定）_

  - [x] 3.2 Phase 2: 環境変数の確認（優先度2）
    - `backend/src/services/GoogleAuthService.ts`の`initializeOAuthClient()`の環境変数確認ログを改善
    - 環境変数の値の一部を表示（セキュリティのため最初の4文字のみ）
    - _Bug_Condition: isBugCondition(input) where 環境変数が未設定_
    - _Expected_Behavior: 環境変数の設定状態がログに記録される_
    - _Preservation: 他のメール送信機能は影響を受けない_
    - _Requirements: 1.2（根本原因特定）_

  - [x] 3.3 Phase 3: エラーハンドリングの改善（優先度3）
    - `backend/src/routes/gmail.ts`の`POST /send`エンドポイントのエラーレスポンスを改善
    - エラー種別に応じたHTTPステータスコードとエラーメッセージを返す（401: GOOGLE_AUTH_REQUIRED, 429: QUOTA_EXCEEDED, 500: EMAIL_SEND_ERROR）
    - タイムアウトエラーのメッセージを改善
    - _Bug_Condition: isBugCondition(input) where 認証エラー、クォータエラー、タイムアウトエラーが発生_
    - _Expected_Behavior: ユーザーに分かりやすいエラーメッセージが返される_
    - _Preservation: 他のメール送信機能は影響を受けない_
    - _Requirements: 2.1（メール送信成功）, 2.2（成功メッセージ表示）_

  - [x] 3.4 バグ条件探索テストを再実行（修正後）
    - **Property 1: Expected Behavior** - メール送信成功
    - **重要**: 修正後のコードで実行し、バグが解消されたことを確認
    - タスク1で作成したテストを修正後のコードで再実行
    - **期待される結果**: テストが成功し、メール送信が正常に完了する（200 OK）
    - エラーログに詳細な情報が記録されることを確認
    - _Requirements: 2.1（メール送信成功）, 2.2（成功メッセージ表示）_

  - [x] 3.5 保存プロパティテストを再実行（修正後）
    - **Property 2: Preservation** - 他のメール送信機能の保持
    - **重要**: 修正後のコードで実行し、既存機能が保持されていることを確認
    - タスク2で作成したテストを修正後のコードで再実行
    - **期待される結果**: テストが成功し、既存機能が修正前と同じ動作を行う
    - _Requirements: 3.1（売主メール送信保持）, 3.2（物件配信メール保持）, 3.3（他機能への影響なし）_

- [-] 4. チェックポイント - 全テストが成功することを確認
  - バグ条件探索テスト（修正後）が成功
  - 保存プロパティテスト（修正後）が成功
  - エラーログが詳細に記録される
  - ユーザーに分かりやすいエラーメッセージが表示される
  - 質問があればユーザーに確認

---

**作成日**: 2026年4月3日  
**最終更新日**: 2026年4月3日
