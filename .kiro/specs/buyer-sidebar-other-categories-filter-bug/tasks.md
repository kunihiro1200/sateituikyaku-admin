# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 基本カテゴリのステータス判定
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `calculateBuyerStatus()` returns empty string for buyers who:
    - Do not match high-priority statuses (Priority 1-35)
    - Have `viewing_date` in the past OR have `follow_up_assignee` set
  - Test cases:
    - 買主7282: `viewing_date = 2026-04-03`（過去）、`follow_up_assignee = 'Y'` → `calculated_status = ''`（空文字列）
    - 買主5641: `viewing_date = 2026-04-05`（過去）、`follow_up_assignee = '林'` → `calculated_status = ''`（空文字列）
    - 買主1234: `viewing_date = NULL`、`follow_up_assignee = 'Y'` → `calculated_status = ''`（空文字列）
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.4, 1.5, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 優先度の高いステータスの判定
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (high-priority statuses)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test cases:
    - 査定アンケート回答あり: `valuation_survey`が非空、`valuation_survey_confirmed`が空 → 「査定アンケート回答あり」
    - 業者問合せあり: `vendor_survey = '未'` → 「業者問合せあり」
    - 内覧日前日: 内覧日が明日（または木曜日の場合は2日後） → 「内覧日前日」
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 買主サイドバー「内覧済み」「担当」カテゴリフィルタ不具合

  - [x] 3.1 Implement the fix in BuyerStatusCalculator.ts
    - Add Priority 36: 内覧済み(イニシャル)の判定ロジック
      - 条件: `viewing_date`が過去の日付 かつ `follow_up_assignee`が存在する
      - ステータス: `内覧済み(イニシャル)`（例：`内覧済み(Y)`、`内覧済み(林)`）
    - Add Priority 37: 担当(イニシャル)の判定ロジック
      - 条件: `follow_up_assignee`が存在する（内覧日の有無に関係なく）
      - ステータス: `担当(イニシャル)`（例：`担当(Y)`、`担当(林)`）
      - 注意: Priority 23-30の担当者別ステータスと重複しないように、Priority 23-30に該当しない場合のみ適用
    - Add Priority 38: 内覧済みの判定ロジック
      - 条件: `viewing_date`が過去の日付 かつ `follow_up_assignee`が存在しない
      - ステータス: `内覧済み`
    - Add debug logging for each priority level
    - _Bug_Condition: isBugCondition(buyer) where buyer does not match Priority 1-35 AND (viewing_date < today OR follow_up_assignee exists)_
    - _Expected_Behavior: expectedBehavior(result) from design - returns '内覧済み(イニシャル)', '担当(イニシャル)', or '内覧済み'_
    - _Preservation: Preservation Requirements from design - Priority 1-15 statuses unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 基本カテゴリのステータス判定
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 優先度の高いステータスの判定
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [-] 4. Integration testing on buyer list page
  - Test clicking "②内覧済み" category shows 1546 buyers
  - Test clicking "担当(Y)" category shows 210 buyers
  - Test clicking "担当(林)" category shows correct buyers
  - Test sidebar counts match list display counts
  - Test existing search and pagination functionality still works

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
