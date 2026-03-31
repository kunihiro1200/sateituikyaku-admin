# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Suumo URL入力済み物件の除外
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `calculatePropertyStatus()` without `workTaskMap` incorrectly categorizes properties with Suumo URL as "レインズ登録＋SUUMO登録" or "SUUMO URL　要登録"
  - Test AA12497 specifically: `suumo_url` is not empty, `atbb_status` is "専任・公開中", `publish_scheduled_date` is before yesterday, `suumo_registered` is not "S不要"
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Suumo URL未入力物件の表示維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (properties without Suumo URL)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test that properties with empty Suumo URL continue to be displayed in "レインズ登録＋SUUMO登録" or "SUUMO URL　要登録" categories
  - Test that properties with `suumo_registered` = "S不要" continue to NOT be displayed
  - Test that properties with `publish_scheduled_date` >= today continue to NOT be displayed
  - Test that properties with `atbb_status` not containing "公開中" continue to NOT be displayed
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for AA12497「レインズ登録＋SUUMO登録」誤表示バグ

  - [x] 3.1 Implement the fix in PropertyListingsPage
    - Fetch work tasks data in `fetchAllData()` using existing `/api/work-tasks` endpoint
    - Create `workTaskMap` using `createWorkTaskMap()` from `propertyListingStatusUtils`
    - Use `useMemo` to optimize `workTaskMap` creation
    - Pass `workTaskMap` to `PropertySidebarStatus` component as prop
    - _Bug_Condition: workTaskMapがundefinedのため、条件6のSuumo URLチェックがスキップされる_
    - _Expected_Behavior: Suumo URLが入力されている物件は「レインズ登録＋SUUMO登録」カテゴリーに表示されない_
    - _Preservation: Suumo URLが空の物件は引き続き「レインズ登録＋SUUMO登録」カテゴリーに表示される_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Update PropertySidebarStatus component
    - Add `workTaskMap?: Map<string, Date | null>` to `PropertySidebarStatusProps` interface
    - Pass `workTaskMap` to `calculatePropertyStatus()` when computing status
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Suumo URL入力済み物件の除外
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Suumo URL未入力物件の表示維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
