# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 訪問日・訪問時間の異常形式検出
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design
  - Test that `syncSingleSeller()` saves visit_date as `2026-04-04 1899-12-30` when input is `2026/04/04 1899/12/30` (from Bug Condition in design)
  - Test that `syncSingleSeller()` saves visit_time as `1899-12-30` when input is `1899/12/30` (from Bug Condition in design)
  - Test that `isVisitDayBefore()` returns false for sellers with malformed visit_date (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 訪問日・訪問時間以外のフィールドの同期処理
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (正常な形式の訪問日・訪問時間)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that `syncSingleSeller()` saves visit_date as `2026-04-04` when input is `2026/04/04` (正常形式)
  - Test that `syncSingleSeller()` saves visit_time as `10:00` when input is `10:00` (正常形式)
  - Test that other fields (name, phone_number, valuation_amount, etc.) are saved correctly (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 訪問日・訪問時間形式修正

  - [x] 3.1 Implement backend fix in EnhancedAutoSyncService.ts
    - Modify `formatVisitDate()` to extract first date when input contains space (e.g., `2026/04/04 1899/12/30` → `2026/04/04`)
    - Add new function `formatVisitTime()` to parse visit_time:
      - Convert Excel serial value (0.0～1.0) to time format (HH:MM)
      - Return null if input contains date format (YYYY/MM/DD)
      - Return as-is if input is already time format (HH:MM)
    - Update `syncSingleSeller()` to use `formatVisitTime()` for visit_time field
    - Update `updateSingleSeller()` to use `formatVisitTime()` for visit_time field
    - _Bug_Condition: isBugCondition(input) where input['訪問日 \nY/M/D'] contains space OR input['訪問時間'] matches date format_
    - _Expected_Behavior: visit_date saved as YYYY/MM/DD format, visit_time saved as HH:MM format (from design)_
    - _Preservation: Other fields (name, phone_number, valuation_amount, etc.) sync logic unchanged (from design)_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Implement frontend validation in sellerStatusFilters.ts
    - Add visit_date format validation in `isVisitDayBefore()`:
      - Extract first date if visit_date contains space
      - Return false if date format is invalid (defensive programming)
    - _Bug_Condition: isBugCondition(input) where seller.visit_date contains space_
    - _Expected_Behavior: isVisitDayBefore() correctly handles malformed visit_date (from design)_
    - _Preservation: Other sidebar category logic unchanged (from design)_
    - _Requirements: 2.3, 3.4_

  - [x] 3.3 Implement frontend validation in sellerStatusUtils.ts
    - Add visit_date format validation in `isVisitDayBefore()`:
      - Extract first date if visit_date contains space
      - Return false if date format is invalid (defensive programming)
    - _Bug_Condition: isBugCondition(input) where seller.visit_date contains space_
    - _Expected_Behavior: isVisitDayBefore() correctly handles malformed visit_date (from design)_
    - _Preservation: Other status calculation logic unchanged (from design)_
    - _Requirements: 2.3, 3.4_

  - [x] 3.4 Create database migration script
    - Create `backend/fix-visit-date-time-format.ts` script
    - Search for sellers with visit_date containing space
    - Extract first date and update visit_date
    - Search for sellers with visit_time in date format (YYYY/MM/DD)
    - Update visit_time to null (time information is lost)
    - Log fixed seller_number and changes
    - _Bug_Condition: isBugCondition(input) where existing data has malformed visit_date or visit_time_
    - _Expected_Behavior: Existing malformed data is corrected (from design)_
    - _Requirements: 2.4_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 訪問日・訪問時間の正しい形式での保存
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3)_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - 訪問日・訪問時間以外のフィールドの同期処理
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: Preservation Requirements from design (3.1, 3.2, 3.3, 3.4)_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
