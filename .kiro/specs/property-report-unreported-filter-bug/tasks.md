# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 報告日設定済み物件が「未報告」に誤表示
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: 報告日が今日以前に設定されている物件（例：AA12636、報告日4/14）が「未報告」と判定されるケースに焦点を当てる
  - Test that calculatePropertyStatus returns 'unreported' for listings with report_date set to today or earlier (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design: report_date が null または未来の場合のみ「未報告」を返すべき
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他のステータス判定ロジックの保存
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (listings with various status conditions)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that other status determination logic (price reduction, confirmation status, public/private status, etc.) remains unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Fix for 報告日判定ロジックの反転

  - [ ] 3.1 Implement the fix
    - `frontend/frontend/src/utils/propertyListingStatusUtils.ts` の104-113行目を修正
    - 判定条件を反転: `if (reportDate && reportDate <= today)` → `if (!reportDate || reportDate > today)`
    - コメントを修正: `// 1. 報告日が今日以前で未報告` → `// 1. 報告日が未設定または未来で未報告`
    - 報告担当者ラベル表示ロジックは変更しない
    - 他のステータス判定ロジック（優先度2以降）は変更しない
    - _Bug_Condition: isBugCondition(listing) where listing.report_date IS NOT NULL AND parseDate(listing.report_date) <= today AND currentLogic(listing) returns 'unreported'_
    - _Expected_Behavior: expectedBehavior(status) from design - report_date が null または未来の場合のみ「未報告」を返す_
    - _Preservation: Preservation Requirements from design - 他のステータス判定ロジック（値下げ予定、確認ステータス、公開/非公開など）が変更されないこと_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 報告日未設定または未来の物件のみ「未報告」に表示
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のステータス判定ロジックの保存
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
