# Implementation Plan

- [ ] 1. バグ条件の探索テストを作成
  - **Property 1: Bug Condition** - スプレッドシートアクセス失敗時に空配列を返すバグ
  - **CRITICAL**: このテストは未修正コードで実行すること。失敗が確認されればバグの存在が証明される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている。修正後にパスすることでバグ解消を確認できる
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `backend/src/services/EmailTemplateService.ts` の `getTemplates()` メソッド
  - バグ条件（`isBugCondition`）: `GoogleSheetsClient.authenticate()` または `spreadsheets.values.get()` が例外をスローし、`catch` ブロックが `return []` で空配列を返す
  - テストシナリオ1: `authenticate()` が例外をスローするようにモックし、`getTemplates()` が例外をスローすることをアサート（未修正コードでは `[]` を返すため FAIL）
  - テストシナリオ2: `spreadsheets.values.get()` が例外をスローするようにモックし、`getTemplates()` が例外をスローすることをアサート（未修正コードでは `[]` を返すため FAIL）
  - テストシナリオ3: `/api/email-templates` エンドポイントが認証失敗時に500を返すことをアサート（未修正コードでは200 OKで `[]` を返すため FAIL）
  - 未修正コードで実行し、反例を記録する（例: 「認証失敗時に `getTemplates()` が例外をスローせず `[]` を返す」）
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい。バグの存在を証明する）
  - _Requirements: 1.3_

- [ ] 2. 保全プロパティテストを作成（修正前に実施）
  - **Property 2: Preservation** - スプレッドシートアクセス成功時の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（スプレッドシートアクセスが成功するケース）の動作を観察する
  - 観察: スプレッドシートから「買主」区分のテンプレートが正常に取得できる場合、`EmailTemplate[]` が返る
  - 観察: `mergePlaceholders()` と `mergeMultipleProperties()` は `getTemplates()` の変更に影響されない
  - 観察: `/api/email-templates/:id/merge-multiple` エンドポイントは `getTemplates()` の変更に影響されない
  - テストシナリオ1: スプレッドシートアクセスが成功するようにモックし、`getTemplates()` が `EmailTemplate[]` を返すことをアサート
  - テストシナリオ2: 返却される `EmailTemplate` オブジェクトが `id`・`name`・`description`・`subject`・`body` を持つことをアサート
  - テストシナリオ3: `mergePlaceholders()` の動作が変更されていないことをアサート
  - 未修正コードで実行し、テストがパスすることを確認する（ベースライン動作の確認）
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい。保全すべきベースライン動作を確認する）
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. `getTemplates()` のバグ修正

  - [ ] 3.1 `EmailTemplateService.getTemplates()` の `catch` ブロックを修正
    - `backend/src/services/EmailTemplateService.ts` を編集する
    - `catch` ブロック内の `return []` を `throw error` に変更する
    - エラーログ（`console.error`）は維持する（要件3.4）
    - 修正前: `return [];`
    - 修正後: `throw error;`
    - `backend/src/routes/emailTemplates.ts` の `GET /` ハンドラはすでに `try/catch` を持ち、エラー時に500を返す実装になっているため変更不要
    - _Bug_Condition: `isBugCondition(input)` where `authenticate()` or `spreadsheets.values.get()` throws Error AND `catch` block returns `[]`_
    - _Expected_Behavior: `getTemplates()` throws Error when spreadsheet access fails; `/api/email-templates` returns 500_
    - _Preservation: スプレッドシートアクセスが成功する場合、`EmailTemplate[]` を返す動作は変更しない_
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 バグ条件の探索テストが今度はパスすることを確認
    - **Property 1: Expected Behavior** - スプレッドシートアクセス失敗時のエラー伝播
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する。新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすれば、バグが修正されたことが確認できる
    - 修正後のコードで実行し、全シナリオがパスすることを確認する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 1.3, 2.1_

  - [ ] 3.3 保全テストが引き続きパスすることを確認
    - **Property 2: Preservation** - スプレッドシートアクセス成功時の動作保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する。新しいテストを書かない
    - 修正後のコードで実行し、全シナリオが引き続きパスすることを確認する
    - リグレッションがないことを確認する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションなし）

- [ ] 4. チェックポイント - 全テストのパスを確認
  - 全テストがパスすることを確認する。質問があればユーザーに確認する。
