# Implementation Plan

- [x] 1. Bug Condition探索テストを作成（修正前）
  - **Property 1: Bug Condition** - inquiry_hearingフィールドの即時同期不具合
  - **重要**: このテストは未修正コードで実行し、失敗することを確認する（失敗＝バグの存在を証明）
  - **修正しようとしない**: テストが失敗しても、テストやコードを修正しない
  - **注意**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **目標**: バグを実証する反例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケース（買主番号7294、inquiry_hearingフィールド）にプロパティをスコープして再現性を確保
  - テスト実装の詳細（Bug Conditionセクションより）:
    - 買主番号7294で`inquiry_hearing`フィールドを「テスト内容」に更新
    - データベースには保存されるが、スプレッドシートのM列（「●問合時ヒアリング」）には反映されないことを確認
    - `BuyerColumnMapper.mapDatabaseToSpreadsheet`と`BuyerWriteService.updateFields`にデバッグログを追加
    - `inquiry_hearing`がどの段階で除外されているか特定
  - テストアサーションはExpected Behavior Propertiesと一致させる:
    - `inquiry_hearing`フィールドの更新がスプレッドシートに即座に反映される
    - HTMLタグが含まれる場合はプレーンテキストに変換される
  - 未修正コードでテストを実行
  - **期待される結果**: テストが失敗する（これは正しい - バグの存在を証明）
  - 反例を記録して根本原因を理解する
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Preservation property testsを作成（修正前）
  - **Property 2: Preservation** - 他のフィールドの同期機能保持
  - **重要**: 観察優先の方法論に従う
  - 未修正コードで非バグ入力（`inquiry_hearing`以外のフィールド）の動作を観察する
  - Preservation Requirementsから観察された動作パターンを捉えるプロパティベーステストを作成:
    - 他のフィールド（「●氏名・会社名」「●内覧日(最新）」など）の即時同期機能
    - `updateRowPartial`による数式保護機能
    - 他のHTMLフィールド（`viewing_result_follow_up`、`message_to_assignee`）のHTMLストリップ処理
  - プロパティベーステストは多くのテストケースを生成し、より強力な保証を提供する
  - 未修正コードでテストを実行
  - **期待される結果**: テストがパスする（保持すべきベースライン動作を確認）
  - 未修正コードでテストを作成・実行し、パスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. inquiry_hearingフィールドの即時同期不具合を修正

  - [x] 3.1 根本原因の特定と修正実装
    - タスク1のデバッグログから根本原因を特定
    - `backend/src/services/BuyerColumnMapper.ts`の`mapDatabaseToSpreadsheet`メソッドを確認
    - `buyer-column-mapping.json`の`databaseToSpreadsheet`セクションに`"inquiry_hearing": "●問合時ヒアリング"`が存在するか確認
    - `formatValueForSpreadsheet`メソッドで`inquiry_hearing`がHTMLフィールドとして認識されているか確認（`const htmlFields = ['inquiry_hearing', 'viewing_result_follow_up', 'message_to_assignee'];`）
    - 過去の実装（コミット`0d9f517a`）を参考に、`updateRowPartial`を使用して数式を上書きしないように実装
    - 修正を適用
    - _Bug_Condition: isBugCondition(input) where input.fieldName == 'inquiry_hearing' AND databaseUpdateSuccessful(input.buyerNumber, input.fieldName, input.newValue) AND NOT spreadsheetUpdated(input.buyerNumber, input.fieldName, input.newValue)_
    - _Expected_Behavior: inquiry_hearingフィールドの更新がスプレッドシートに即座に反映され、HTMLタグが含まれる場合はプレーンテキストに変換される（expectedBehavior from design）_
    - _Preservation: 他のフィールドの同期機能、数式保護機能、HTMLストリップ処理が変更されない（Preservation Requirements from design）_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Bug condition探索テストが成功することを確認
    - **Property 1: Expected Behavior** - inquiry_hearingフィールドの即時同期
    - **重要**: タスク1と同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のbug condition探索テストを再実行
    - **期待される結果**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3, 2.4)_

  - [x] 3.3 Preservation testsが引き続きパスすることを確認
    - **Property 2: Preservation** - 他のフィールドの同期機能保持
    - **重要**: タスク2と同じテストを再実行する - 新しいテストを作成しない
    - タスク2のpreservation property testsを再実行
    - **期待される結果**: テストがパスする（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認（リグレッションなし）

- [x] 4. Checkpoint - 全てのテストがパスすることを確認
  - 全てのテストがパスすることを確認し、疑問点があればユーザーに質問する
