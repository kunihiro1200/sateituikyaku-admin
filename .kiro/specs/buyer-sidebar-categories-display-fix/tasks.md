# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - サイドバーカテゴリーの表示
  - **CRITICAL**: このテストは修正前のコードで実行し、バグの存在を確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを確認する反例を見つける
  - **Scoped PBT Approach**: 決定的なバグのため、具体的な失敗ケースにプロパティをスコープする
  - Test implementation details from Bug Condition in design
  - APIエンドポイント `/api/buyers/status-categories-with-buyers` を呼び出す
  - レスポンスの `statusCategoriesWithBuyers` が空の配列 `[]` であることを確認（バグの存在確認）
  - 期待される動作: `statusCategoriesWithBuyers.length > 0` かつ `viewingDayBefore`, `todayCall`, `assigned` カテゴリーが含まれる
  - 修正前のコードで実行
  - **EXPECTED OUTCOME**: テストが失敗する（これは正しい - バグが存在することを証明）
  - 反例を記録してバグの根本原因を理解する
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 売主リストと買主データの同期
  - **IMPORTANT**: observation-first methodology に従う
  - 修正前のコードで非バグ条件の入力（売主リストページ、買主データ同期）の動作を観察
  - 観察された動作パターンをキャプチャするプロパティベーステストを書く
  - Preservation Requirements から観察された動作パターンをキャプチャするプロパティベーステストを書く
  - プロパティベーステストは多くのテストケースを自動生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストがパスする（これはベースライン動作を保持することを確認）
  - テストが書かれ、実行され、修正前のコードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 買主リストサイドバーカテゴリー表示バグ

  - [x] 3.1 GASの時間トリガーを設定
    - Google Apps Script エディタを開く
    - `setupBuyerSyncTrigger()` 関数を選択して実行
    - 実行ログで「✅ 買主同期トリガー設定完了」が表示されることを確認
    - トリガー管理画面で `syncBuyerList` の10分トリガーが存在することを確認
    - トリガーの詳細を確認:
      - 実行する関数: `syncBuyerList`
      - イベントのソース: 時間主導型
      - 時間ベースのトリガーのタイプ: 分ベースのタイマー
      - 時間の間隔: 10分ごと
    - _Bug_Condition: isBugCondition(input) where input.endpoint = "/api/buyers/status-categories-with-buyers"_
    - _Expected_Behavior: expectedBehavior(result) from design - statusCategoriesWithBuyers.length > 0_
    - _Preservation: Preservation Requirements from design - 売主リストと買主データの同期が変わらない_
    - _Requirements: 1.3, 1.4, 2.3, 2.4_

  - [x] 3.2 GASの手動実行でテスト
    - GASエディタで `testBuyerSync()` 関数を選択して実行
    - 実行ログで以下を確認:
      - `📊 買主サイドバーカウント更新開始...`
      - `✅ buyer_sidebar_counts INSERT成功: X件`
      - `📊 買主サイドバーカウント更新完了: 合計 X行`
    - エラーが発生した場合は実行ログを確認して修正
    - _Requirements: 2.3, 2.4_

  - [x] 3.3 `buyer_sidebar_counts` テーブルのデータを確認
    - Supabase SQL Editorで以下のクエリを実行:
      ```sql
      SELECT * FROM buyer_sidebar_counts ORDER BY category, assignee;
      ```
    - 期待される結果: 各カテゴリーのデータが存在する
      - `viewingDayBefore`, `todayCall`, `assigned`, `todayCallAssigned` など
    - データが存在しない場合は3.2に戻ってGASの実行ログを確認
    - データが古い場合は次回の自動実行を待つ（最大10分）
    - _Requirements: 1.3, 2.3_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - サイドバーカテゴリーの表示
    - **IMPORTANT**: タスク1と同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすると、期待される動作が満たされていることを確認
    - バグ条件探索テスト（ステップ1）を再実行
    - **EXPECTED OUTCOME**: テストがパスする（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design - 2.1, 2.2_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - 売主リストと買主データの同期
    - **IMPORTANT**: タスク2と同じテストを再実行する - 新しいテストを書かない
    - 保存プロパティテスト（ステップ2）を再実行
    - **EXPECTED OUTCOME**: テストがパスする（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全てのテストがパスすることを確認し、質問があればユーザーに確認する
