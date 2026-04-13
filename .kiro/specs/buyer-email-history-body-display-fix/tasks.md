# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - logEmail() 呼び出し時に body が欠落するバグ
  - **重要**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **修正前にテストが失敗しても、テストやコードを修正しないこと**
  - **注意**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグの存在を示すカウンターサンプルを発見する
  - **スコープ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `backend/src/routes/gmail.ts` の `/send` エンドポイントをモックでシミュレートし、`activityLogService.logEmail()` が `body` パラメータなしで呼び出されることを確認する（Bug Condition: `input.logEmailParams.body = undefined` かつ `bodyText IS NOT undefined`）
  - テストアサーション: `logEmail()` の引数オブジェクトに `body` フィールドが存在しないこと（修正前）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見されたカウンターサンプルを記録する（例: `logEmail()` の引数に `body` フィールドが存在しない）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - body パラメータ追加が既存動作に影響しない
  - **重要**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ入力（isBugCondition が false のケース）の動作を観察する
  - 観察: SMS履歴操作では `logEmail()` は呼び出されない（既存動作）
  - 観察: メール送信成功時に `email_history` テーブルへの保存が行われる（既存動作）
  - 観察: 送信成功レスポンス `{ success: true }` が返される（既存動作）
  - 観察: 添付ファイル付き送信でも同様の処理フローが維持される（既存動作）
  - プロパティベーステスト: ランダムなメール本文・件名・買主IDの組み合わせで、`body` パラメータ追加が `email_history` 保存・送信レスポンス・エラーハンドリングに影響しないことを検証（Preservation Requirements より）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを書き、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. body パラメータ欠落バグの修正

  - [x] 3.1 修正を実装する
    - `backend/src/routes/gmail.ts` の `router.post('/send', ...)` 内の `activityLogService.logEmail()` 呼び出し箇所を特定する
    - `activityLogService.logEmail()` の引数オブジェクトに `body: bodyText` を1行追加する
    - 変更前: `createdBy: employeeId,` で終わる呼び出し
    - 変更後: `createdBy: employeeId,` の後に `body: bodyText,` を追加
    - 他の処理（メール送信、email_history保存、エラーハンドリング）は一切変更しない
    - _Bug_Condition: isBugCondition(input) where input.endpoint = '/send' AND input.logEmailParams.body = undefined AND bodyText IS NOT undefined_
    - _Expected_Behavior: logEmail() が body: bodyText パラメータ付きで呼び出され、activity_logs.metadata.body にメール本文が保存される_
    - _Preservation: SMS履歴動作・email_history保存・送信レスポンス・エラーハンドリング・添付ファイル送信は変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - logEmail() 呼び出し時に body が保存される
    - **重要**: タスク1で書いた同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - body パラメータ追加が既存動作に影響しない
    - **重要**: タスク2で書いた同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
