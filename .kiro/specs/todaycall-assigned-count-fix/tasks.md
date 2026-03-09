# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Fault Condition** - 当日TEL（担当）・訪問予定・訪問済みカテゴリボタン欠落バグ
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることでバグ修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - `SellerStatusSidebar.tsx` の `renderAllCategories()` をレンダリングし、以下を確認する：
    - 営担「Y」+ 次電日「2026-01-30」（今日以前）の売主が存在する場合、「当日TEL（担当）」ボタンが存在しないこと
    - 営担「Y」+ 訪問日「2026-02-10」（今日以降）の売主が存在する場合、「訪問予定」ボタンが存在しないこと
    - 営担「Y」+ 訪問日「2026-01-20」（昨日以前）の売主が存在する場合、「訪問済み」ボタンが存在しないこと
    - `categoryCounts.todayCallAssigned = 5` を渡してもボタンが表示されないこと
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが**FAIL**する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `renderCategoryButton('todayCallAssigned', ...)` の呼び出しが欠落）
  - テストを作成・実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存カテゴリ（当日TEL分・当日TEL（内容）など）の動作維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isTodayCallAssigned` が false の売主）に対する動作を観察する
  - 観察: `isTodayCall` の判定結果（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）
  - 観察: `isTodayCallWithInfo` の判定結果（追客中 + 次電日が今日以前 + コミュニケーション情報のいずれかに入力あり + 営担なし）
  - 観察: `isUnvaluated`・`isMailingPending`・`isTodayCallNotStarted`・`isPinrichEmpty` の判定結果
  - プロパティベーステストを作成する：ランダムな売主データに対して上記の判定結果が変わらないことを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが**PASS**する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成・実行し、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 当日TEL（担当）・訪問予定・訪問済みカテゴリ表示バグの修正

  - [x] 3.1 `SellerStatusSidebar.tsx` の修正を実装する
    - `renderAllCategories()` に `renderCategoryButton('todayCallAssigned', '当日TEL（担当）', '#ff5722')` を追加（`todayCall` の前）
    - `renderAllCategories()` に `renderCategoryButton('visitScheduled', '①訪問予定', '#2e7d32')` を追加
    - `renderAllCategories()` に `renderCategoryButton('visitCompleted', '②訪問済み', '#1565c0')` を追加
    - ローカルの `filterSellersByCategory` 関数に `todayCallAssigned`・`visitScheduled`・`visitCompleted` のケースを追加
    - `sellerStatusFilters` からのインポートに `isTodayCallAssigned`・`isVisitScheduled`・`isVisitCompleted` を追加
    - _Bug_Condition: `renderAllCategories()` に `renderCategoryButton('todayCallAssigned', ...)` の呼び出しが存在しない状態_
    - _Expected_Behavior: 各カテゴリボタンが表示され、`isTodayCallAssigned`・`isVisitScheduled`・`isVisitCompleted` 条件を満たす売主の件数が正しく表示される_
    - _Preservation: `isTodayCall`・`isTodayCallWithInfo`・`isUnvaluated`・`isMailingPending`・`isTodayCallNotStarted`・`isPinrichEmpty` のロジックは変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが今度はPASSすることを確認する
    - **Property 1: Expected Behavior** - 当日TEL（担当）・訪問予定・訪問済みカテゴリボタンの表示
    - **IMPORTANT**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが**PASS**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 既存カテゴリの動作維持
    - **IMPORTANT**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが**PASS**する（リグレッションがないことを確認）
    - 修正後も全ての既存カテゴリが正しく動作することを確認する

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テスト（タスク1・タスク2のテスト）がPASSすることを確認する
  - 疑問点があればユーザーに確認する
