# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 担当(Y)カテゴリのフィルタリング不一致
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
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他のカテゴリのフィルタリング
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for 買主「担当(Y)」フィルタバグ

  - [x] 3.1 Implement the fix
    - `BuyerService.getBuyersByStatus()` メソッドを修正
    - 担当カテゴリのパターンマッチングを追加（`/^担当\((.+)\)$/`）
    - 担当カテゴリの場合、`follow_up_assignee` または `initial_assignee` でフィルタリング
    - デバッグログを追加（買主番号、担当者、判定結果）
    - 他の担当カテゴリ（担当(I)、担当(久)、担当(外す)）も同様に修正
    - _Bug_Condition: isBugCondition(input) where input.statusCategory matches '担当\\([A-Z久外す]+\\)'_
    - _Expected_Behavior: サイドバーカウントと一覧表示件数が一致し、正しく3件が表示される_
    - _Preservation: 他のサイドバーカテゴリ（「当日TEL」「内覧日前日」など）のフィルタリングが正常に動作し続ける_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 担当(Y)カテゴリのフィルタリング一致
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のカテゴリのフィルタリング
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
