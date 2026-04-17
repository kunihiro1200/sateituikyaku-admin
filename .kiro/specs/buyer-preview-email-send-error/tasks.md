# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - `refreshAccessToken()` 失敗時にリトライなしで即座に500エラーになるバグ
  - **重要**: このテストは未修正コードで必ず FAIL する — FAIL することがバグの存在を証明する
  - **修正を試みないこと** — テストが失敗しても、コードを修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目標**: バグが存在することを示すカウンターサンプルを発見する
  - テスト対象: `GoogleAuthService.getAuthenticatedClient()` が `refreshAccessToken()` の一時的な失敗に対してリトライしないこと（Bug Condition: `refreshAccessToken()` が一時的なエラーを返す）
  - テスト内容:
    - `refreshAccessToken()` が429エラーを返すようにモック → 現在のコードがリトライせずに即座に `GOOGLE_AUTH_REQUIRED` をスローすることを確認（未修正コードで PASS = バグの証明）
    - `refreshAccessToken()` がタイムアウトエラーを返すようにモック → 現在のコードが即座に失敗することを確認
    - `refreshAccessToken()` が503エラーを返すようにモック → 現在のコードが即座に失敗することを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `refreshAccessToken()` が429エラーで失敗すると、リトライなしで即座に `GOOGLE_AUTH_REQUIRED` がスローされる）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 正常ケースおよび他機能の動作維持
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`refreshAccessToken()` が成功するケース、永続的エラーのケース）の動作を観察する
  - 観察内容:
    - `refreshAccessToken()` が成功する場合 → 認証済みクライアントが返されることを確認
    - `refreshAccessToken()` が `invalid_grant` を返す場合 → `GOOGLE_AUTH_REQUIRED` がスローされることを確認
    - メール送信成功時 → `email_history` と `activity_logs` への記録が行われることを確認
  - プロパティベーステストを作成: `refreshAccessToken()` が成功する任意の入力に対して、`getAuthenticatedClient()` が認証済みクライアントを返すことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. トークン更新リトライロジックの実装

  - [x] 3.1 一時的エラー判定ヘルパー関数 `isTransientError()` を追加する
    - `backend/src/services/GoogleAuthService.ts` に `private isTransientError(error: any): boolean` メソッドを追加する
    - 一時的エラー（429、500、503、`ECONNRESET`、`ETIMEDOUT`、`ENOTFOUND`、タイムアウト、ネットワーク関連）は `true` を返す
    - 永続的エラー（`invalid_grant`、`Token has been expired or revoked`、`GOOGLE_AUTH_REQUIRED`）は `false` を返す
    - _Bug_Condition: `refreshAccessToken()` が一時的なエラーを返す_
    - _Expected_Behavior: 一時的エラーと永続的エラーを正確に区別する_
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 `getAuthenticatedClient()` にエクスポネンシャルバックオフ付きリトライロジックを追加する
    - `backend/src/services/GoogleAuthService.ts` の `getAuthenticatedClient()` メソッドを修正する
    - `refreshAccessToken()` の呼び出しを最大3回リトライするループでラップする
    - リトライ間隔: 1秒 → 2秒 → 4秒（エクスポネンシャルバックオフ）
    - 一時的エラーの場合はリトライ、永続的エラーの場合は即座に `GOOGLE_AUTH_REQUIRED` をスロー
    - 全リトライが失敗した場合は `GOOGLE_AUTH_REQUIRED` をスロー
    - リトライ試行のログを追加する
    - _Bug_Condition: `refreshAccessToken()` が一時的なエラーを返す_
    - _Expected_Behavior: 一時的な失敗はリトライで自動回復し、メール送信を完了する_
    - _Preservation: `refreshAccessToken()` が成功する正常ケースは完全に影響を受けない。永続的エラーは修正前と同じく即座に `GOOGLE_AUTH_REQUIRED` をスロー_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 `getAuthenticatedClientForEmployee()` にも同様のリトライロジックを追加する
    - `backend/src/services/GoogleAuthService.ts` の `getAuthenticatedClientForEmployee()` メソッドを修正する
    - `getAuthenticatedClient()` と同じリトライロジックを適用する
    - カレンダー送信など他のGoogle API機能（要件3.4）を保護する
    - _Preservation: カレンダー送信など他のGoogle API機能が引き続き正常に動作する_
    - _Requirements: 3.4_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - トークン更新失敗時のリトライ回復
    - **重要**: タスク 1 と同じテストを再実行する — 新しいテストを作成しない
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク 1 のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 正常ケースおよび他機能の動作維持
    - **重要**: タスク 2 と同じテストを再実行する — 新しいテストを作成しない
    - タスク 2 の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全ての保全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク 1 のバグ条件探索テストが PASS することを確認する
  - タスク 2 の保全プロパティテストが PASS することを確認する
  - 疑問点があればユーザーに確認する
