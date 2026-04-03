# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 欠落カテゴリが計算されない
  - **CRITICAL**: このテストは修正前のコードで実行し、MUST FAIL（失敗）することを確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: 現在のGASコードが一部のカテゴリ（4種類）しか計算・挿入していないことを確認する
  - **Scoped PBT Approach**: 手動テストで代替（GAS環境ではProperty-based testingが困難）
  - GASエディタで`updateBuyerSidebarCounts_()`を手動実行
  - 実行ログで4種類のカテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）のみが挿入されることを確認
  - `buyer_sidebar_counts`テーブルをクエリして、欠落カテゴリ（`visitCompleted`, `unvaluated`, `mailingPending`など）が存在しないことを確認
  - フロントエンドで買主リストページを開き、サイドバーに「①内覧日前日」と「すべて」しか表示されないことを確認
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既存カテゴリの計算ロジック保存
  - **IMPORTANT**: Follow observation-first methodology
  - 修正前のコードで既存カテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）のカウント数を記録
  - 手動テストで既存カテゴリのカウント数が修正前後で一致することを確認
  - GASの10分トリガーが修正後も同じ間隔で実行されることを確認
  - バックエンドの`BuyerService.getSidebarCounts()`が修正後も同じマッピングで動作することを確認
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 買主リストサイドバー欠落カテゴリ

  - [x] 3.1 `gas_buyer_complete_code.js`の`updateBuyerSidebarCounts_()`関数を修正
    - カウント変数の初期化を拡張（9種類の欠落カテゴリを追加）
    - 内覧済みカテゴリの計算ロジックを追加（`visitCompleted`）
    - 未査定カテゴリの計算ロジックを追加（`unvaluated`）
    - 査定郵送カテゴリの計算ロジックを追加（`mailingPending`）
    - 当日TEL未着手カテゴリの計算ロジックを追加（`todayCallNotStarted`）
    - Pinrich空欄カテゴリの計算ロジックを追加（`pinrichEmpty`）
    - 専任・一般・訪問後他決・未訪問他決カテゴリの計算ロジックを追加（`exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`）
    - Supabaseへの保存処理を拡張（9種類の欠落カテゴリを追加）
    - 買主特有のフィールド名に調整（`後続担当`, `●内覧日(最新）`, `★最新状況\n`, `★次電日`）
    - 売主GASコード（`gas_complete_code.js`の`updateSidebarCounts_()`関数、lines 777-1000+）を参考にする
    - _Bug_Condition: isBugCondition(gasExecution) where gasExecution.insertedCategories.length == 4_
    - _Expected_Behavior: gasExecution.insertedCategories.length >= 12 AND gasExecution.insertedCategories CONTAINS ['visitCompleted', 'unvaluated', 'mailingPending', ...]_
    - _Preservation: 既存の4種類のカテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）の計算ロジックは変更しない_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 GASエディタに修正後のコードをコピー＆ペースト
    - Google スプレッドシートを開く
    - 「拡張機能」→「Apps Script」を選択
    - `gas_buyer_complete_code.js`の内容を**全て**コピー
    - GASエディタに**全て**ペースト（既存コードを上書き）
    - 保存（Ctrl+S）
    - _Requirements: 2.2_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 全カテゴリが計算される
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - GASエディタで修正後の`updateBuyerSidebarCounts_()`を手動実行
    - 実行ログで12種類以上のカテゴリが挿入されることを確認
    - `buyer_sidebar_counts`テーブルをクエリして、全カテゴリが存在することを確認
    - フロントエンドで買主リストページを開き、サイドバーに全カテゴリが表示されることを確認（カウントが0より大きい場合）
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存カテゴリの計算ロジック保存
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - 修正後のコードで既存カテゴリ（`viewingDayBefore`, `todayCall`, `inquiryEmailNotResponded`, `assigned`）のカウント数を確認
    - 修正前のカウント数と一致することを確認
    - GASの10分トリガーが修正後も同じ間隔で実行されることを確認
    - バックエンドの`BuyerService.getSidebarCounts()`が修正後も同じマッピングで動作することを確認
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - GASの10分トリガーが正常に実行されることを確認
  - `buyer_sidebar_counts`テーブルに全カテゴリが存在することを確認
  - フロントエンドで買主リストページを開き、サイドバーに全カテゴリが表示されることを確認
  - 売主リストページと買主リストページの両方で、サイドバーが正しく動作することを確認
