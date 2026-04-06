# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 「●問合時ヒアリング」同期不具合の再現
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他フィールドの同期処理保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 「●問合時ヒアリング」同期不具合

  - [x] 3.1 根本原因の特定と修正実装
    - 探索的テスト（タスク1）の結果に基づき、4つの仮説のうち該当する原因を特定
    - 仮説1: `detectUpdatedBuyers`で`inquiry_hearing`が比較対象外 → `skipFields`から削除または比較ロジックに追加
    - 仮説2: `BuyerColumnMapper`の変換処理の問題 → `convertValue`メソッドで空文字/null処理を修正
    - 仮説3: `updateSingleBuyer`で更新対象外 → `manualPriorityFields`から削除
    - 仮説4: カラムマッピング読み込み失敗 → `buyer-column-mapping.json`のキー名を確認・修正
    - デバッグログを追加して、各処理段階で`inquiry_hearing`の値を追跡
    - _Bug_Condition: isBugCondition(input) where input.sheetInquiryHearing !== input.dbInquiryHearing AND syncProcessExecuted() AND input.dbInquiryHearing NOT UPDATED_
    - _Expected_Behavior: スプレッドシートの「●問合時ヒアリング」列を更新した場合、データベースの`inquiry_hearing`カラムが正しく更新される_
    - _Preservation: 他のフィールド（「●氏名・会社名」「●内覧日(最新）」など）の同期処理は変更せず、正常に動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 「●問合時ヒアリング」同期不具合の修正確認
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他フィールドの同期処理保持確認
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
