# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 通知送信者フィールドDB→スプレッドシート同期失敗
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when updating `notification_sender` field via BuyerWriteService, the value is correctly synced to spreadsheet BS column
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他のフィールドの同期が正常に動作
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (other fields like viewing_date, latest_status, next_call_date)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 通知送信者フィールドDB→スプレッドシート同期バグ

  - [x] 3.1 Investigate root cause via Vercel logs
    - Check if `[BuyerWriteService] updateFields called for buyer` is logged
    - Check if `[BuyerColumnMapper] Mapping notification_sender -> 通知送信者` is logged
    - Check if `[BuyerWriteService] Successfully updated row` is logged
    - Identify which stage is failing (routing, mapping, or spreadsheet update)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Implement fix based on root cause
    - **Case 1**: If BuyerWriteService not called → Fix routing/controller
    - **Case 2**: If BuyerColumnMapper not mapping → Fix BuyerColumnMapper
    - **Case 3**: If GoogleSheetsClient not updating → Fix GoogleSheetsClient
    - Add debug logs to track the sync process
    - _Bug_Condition: isBugCondition(input) where input.fieldName = 'notification_sender'_
    - _Expected_Behavior: notification_sender is synced to both database and spreadsheet BS column_
    - _Preservation: Other fields (viewing_date, latest_status, next_call_date) continue to sync normally_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 通知送信者フィールドDB→スプレッドシート同期成功
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のフィールドの同期が正常に動作
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
