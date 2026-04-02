# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - フィールド削除時のデータベース更新失敗
  - **CRITICAL**: このテストは修正前のコードで実行し、必ず失敗することを確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを示す反例を表面化させる
  - **Scoped PBT Approach**: 決定論的なバグのため、プロパティを具体的な失敗ケースにスコープする
  - テスト実装の詳細（Bug Conditionから）:
    - 買主番号7230の内覧日をスプレッドシートで削除（空欄に）
    - GASの`syncUpdatesToSupabase_`関数を実行
    - データベースの`viewing_date`カラムがnullに更新されることをアサート（期待される動作）
  - 修正前のコードで実行
  - **EXPECTED OUTCOME**: テストが失敗する（これは正しい - バグが存在することを証明）
  - 反例を文書化して根本原因を理解する
  - タスク完了条件: テストが作成され、実行され、失敗が文書化されたらタスク完了とする
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 新しい値入力時の同期動作
  - **IMPORTANT**: 観察優先の方法論に従う
  - 修正前のコードで非バグ入力（新しい値を入力する操作）の動作を観察する
  - 観察された動作パターンを捕捉するプロパティベーステストを作成（Preservation Requirementsから）
  - プロパティベーステストは多くのテストケースを生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストがパスする（これはベースライン動作を保持することを確認）
  - タスク完了条件: テストが作成され、修正前のコードで実行され、パスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 買主リスト同期バグ（フィールド削除時のデータベース更新失敗）

  - [x] 3.1 Implement the fix
    - `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`関数に`normalizeValue`ヘルパー関数を追加
    - 全フィールドの比較ロジックに正規化ロジックを適用（`latest_status`, `next_call_date`, `initial_assignee`, `follow_up_assignee`, `inquiry_email_phone`, `three_calls_confirmed`, `reception_date`, `distribution_type`, `desired_area`）
    - 削除（null化）が検出された場合のログ出力を改善
    - _Bug_Condition: isBugCondition(input) where (input.sheetValue === null OR input.sheetValue === '') AND (input.dbValue !== null AND input.dbValue !== '') AND NOT fieldIsUpdatedInDatabase(input.sheetValue, input.dbValue)_
    - _Expected_Behavior: expectedBehavior(result) from design - スプレッドシートでフィールドを空欄にした場合、データベースの該当カラムもnullまたは空文字列に更新される_
    - _Preservation: Preservation Requirements from design - 新しい値を入力した場合の同期、サイドバーカウント更新、10分トリガー、追加同期、削除同期は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - フィールド削除時のデータベース更新
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを再実行
    - **EXPECTED OUTCOME**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 新しい値入力時の同期動作
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保全プロパティテストを再実行
    - **EXPECTED OUTCOME**: テストがパスする（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
