# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 買主番号7260の初動担当「久」保存時の同期エラー
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that saving initial_assignee='久' for buyer_number='7260' triggers sync errors (404, 409)
  - Test implementation details from Bug Condition in design
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - 404エラー: `/api/buyers/7260/related` が失敗する
    - 409エラー: `/api/buyers/7260?sync=true` が競合を検出する
    - スプレッドシート同期失敗のエラーメッセージが表示される
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他の買主・フィールド・値での保存動作が保持される
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test cases:
    - 買主番号7260以外の買主で初動担当「久」を保存 → 正常に動作
    - 買主番号7260で初動担当「久」以外の値（「Y」「I」など）を保存 → 正常に動作
    - 買主番号7260で初動担当以外のフィールド（問合せ元など）を保存 → 正常に動作
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 買主番号7260の初動担当保存時スプレッドシート同期エラー

  - [x] 3.1 Investigate root cause
    - 買主番号7260のデータ整合性を確認（buyer_idの存在確認）
    - `/api/buyers/7260/related` エンドポイントの404エラー原因を特定
    - `updateWithSync` メソッドの409エラー原因を特定
    - スプレッドシート書き込みエラーの原因を特定
    - 根本原因を特定してから修正方針を決定
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement the fix based on root cause
    - **Option A**: 買主番号7260のデータ不整合が原因の場合
      - データ修復スクリプトを作成（buyer_idの生成・設定）
      - `BuyerService.getByBuyerNumber()` にデータ整合性チェックを追加
    - **Option B**: 競合検出ロジックの誤動作が原因の場合
      - `BuyerService.updateWithSync()` の競合チェックロジックを修正
      - スプレッドシート現在値取得時のエラーハンドリングを強化
    - **Option C**: スプレッドシート書き込みエラーが原因の場合
      - `BuyerSpreadsheetWriteService.updateFields()` のエラーハンドリングを強化
      - 初動担当カラムのマッピングを確認・修正
    - _Bug_Condition: isBugCondition(input) where input.buyerNumber == '7260' AND input.fieldName == 'initial_assignee' AND input.newValue == '久'_
    - _Expected_Behavior: expectedBehavior(result) from design - DB保存とスプレッドシート同期の両方が成功_
    - _Preservation: Preservation Requirements from design - 他の買主・フィールド・値での保存が正常動作_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 買主番号7260の初動担当「久」保存が成功する
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify no error messages are displayed
    - Verify DB and spreadsheet are both updated successfully
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - 他の買主・フィールド・値での保存動作が保持される
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
