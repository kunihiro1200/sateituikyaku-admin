# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - getAuthenticatedClient トークン更新失敗
  - **重要**: このテストは修正前のコードで実行し、**必ず失敗することを確認する**
  - **失敗してもテストやコードを修正しないこと**
  - **目的**: バグが実際に存在することを反例で証明する
  - **スコープ**: `GoogleAuthService.getAuthenticatedClient()` を呼び出し、返されたクライアントが有効なアクセストークンを持つか確認
  - テスト内容: `getAuthenticatedClient()` を呼び出し、`client.refreshAccessToken()` が呼ばれていないことを確認（`getAuthenticatedClientForEmployee` との動作差異を比較）
  - テスト内容: `EmailService.sendBuyerEmail()` に有効なパラメータを渡し、`{ success: false }` が返ることを確認
  - バグ条件（design.mdより）: `isBugCondition(input)` = `POST /api/gmail/send` に有効なパラメータを送信した際に `sendBuyerEmail()` が `success: false` を返す
  - 修正前のコードで実行 → **テストが失敗することを期待**（バグの存在を証明）
  - 発見した反例を記録する（例: `getAuthenticatedClient()` が期限切れトークンを持つクライアントを返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件外の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ入力（メール送信以外の操作）の動作を観察・記録する
  - 観察: `mergeMultiple` エンドポイントがテンプレートのプレースホルダーを正しく置換することを確認
  - 観察: `BuyerService.getById()` が `buyer_number` と `buyer_id` の両方で正しく検索できることを確認
  - 観察: `/api/gmail/send-to-buyer` エンドポイントが正常に動作することを確認
  - プロパティベーステスト: バグ条件外（`isBugCondition` が false）の全入力に対して、修正前後で動作が一致することを検証
  - 修正前のコードでテストを実行 → **テストが成功することを期待**（ベースライン動作の確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. getAuthenticatedClient のトークン更新バグを修正する

  - [x] 3.1 getAuthenticatedClient() を修正する
    - `backend/src/services/GoogleAuthService.ts` の `getAuthenticatedClient()` メソッドを修正
    - `getAccessToken()` の呼び出しを削除（二重DBアクセスを排除）
    - DBからリフレッシュトークンを一度だけ取得する
    - `client.setCredentials({ refresh_token: refreshToken })` でリフレッシュトークンのみ設定
    - `client.refreshAccessToken()` を呼び出してアクセストークンを自動更新（`getAuthenticatedClientForEmployee` と同様のパターン）
    - トークンが見つからない場合や更新失敗時に `GOOGLE_AUTH_REQUIRED` エラーをスロー
    - _Bug_Condition: `isBugCondition(input)` = `getAuthenticatedClient()` が `client.refreshAccessToken()` を呼ばずにアクセストークンを直接設定している_
    - _Expected_Behavior: `getAuthenticatedClient()` が `getAuthenticatedClientForEmployee()` と同様に `refreshAccessToken()` でトークンを更新し、有効なクライアントを返す_
    - _Preservation: `getAuthenticatedClient()` の修正のみ。`mergeMultiple`・`BuyerService.getById`・`send-to-buyer` エンドポイントには影響しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - getAuthenticatedClient トークン更新成功
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、修正が正しく機能していることを確認できる
    - タスク1のバグ条件探索テストを再実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを証明）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - バグ条件外の動作保持
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク2の保全プロパティテストを再実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全ての保全テストが成功することを確認する

- [x] 4. チェックポイント - 全テストの成功を確認する
  - 全テスト（バグ条件テスト・保全テスト）が成功することを確認する
  - 疑問点があればユーザーに確認する
