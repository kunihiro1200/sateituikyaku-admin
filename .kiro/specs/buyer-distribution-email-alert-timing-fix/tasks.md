# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 配信メール変更時の即時バリデーション
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
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 配信メール「不要」時の動作と希望条件入力済み時の動作
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for 配信メール注意喚起タイミング修正

  - [x] 3.1 Implement the fix
    - `handleInlineFieldSave` 関数で、`distribution_type` フィールドの場合はバリデーションをスキップ
    - 値の変更を許可し、DBに保存する
    - `handleNavigate` 関数で、「配信メール」が「要」かつ希望条件が未入力の場合にバリデーションを実行
    - 希望条件ページへの遷移時は、バリデーションをスキップする
    - _Bug_Condition: isBugCondition(input) where input.action === 'change_distribution_type' AND input.distribution_type === '要' AND desired_conditions are empty AND alert_shown_immediately === true_
    - _Expected_Behavior: expectedBehavior(result) from design - ボタンを押せるようにし、値を「要」に変更する。ページ遷移時に注意喚起を表示する_
    - _Preservation: Preservation Requirements from design - 「配信メール」を「不要」に変更した場合や、希望条件が全て入力済みの場合の既存動作を維持_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 配信メール変更時の即時バリデーション除外
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design - Property 1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 配信メール「不要」時の動作と希望条件入力済み時の動作
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
