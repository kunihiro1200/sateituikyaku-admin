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

- [ ] 5. データベース構造変更（TIMESTAMP型への移行）

  - [x] 5.1 Create database migration script
    - Create `backend/migrations/migrate-visit-date-to-timestamp.sql`
    - Step 1: Add temporary column `visit_datetime` as TIMESTAMP
    - Step 2: Migrate existing data: Combine `visit_date` and `visit_time` into `visit_datetime`
      - Example: `visit_date='2026-04-04'`, `visit_time='10:00'` → `visit_datetime='2026-04-04 10:00:00'`
      - Handle null values: If `visit_time` is null, use `visit_date` only
    - Step 3: Drop `visit_time` column
    - Step 4: Rename `visit_datetime` to `visit_date`
    - _Requirements: データベース構造の変更_

  - [x] 5.2 Update GAS sync logic
    - Modify `gas_complete_code.js` `syncUpdatesToSupabase_()` function
    - Combine `訪問日 Y/M/D` and `訪問時間` columns into single TIMESTAMP
    - Extract time from Date object using `getHours()` and `getMinutes()`
    - Format as `YYYY/MM/DD HH:MM:SS` (e.g., `2026/04/04 10:00:00`)
    - Save to `visit_date` column only (no more `visit_time`)
    - _Requirements: GAS同期処理の修正_

  - [x] 5.3 Update backend SellerService
    - Modify `backend/src/services/SellerService.supabase.ts`
    - Update `decryptSeller()` to handle `visit_date` as TIMESTAMP
    - Remove `visitTime` field from response
    - Return `visitDate` as ISO 8601 format (e.g., `2026-04-04T10:00:00.000Z`)
    - _Requirements: バックエンドAPIの修正_

  - [x] 5.4 Update frontend display logic
    - Modify `frontend/frontend/src/pages/CallModePage.tsx`
    - Extract date and time from `visitDate` TIMESTAMP
    - Display as `YYYY/MM/DD HH:MM` format (e.g., `2026/04/04 10:00`)
    - Update `frontend/frontend/src/utils/sellerStatusFilters.ts` to extract date part from TIMESTAMP
    - _Requirements: フロントエンド表示の修正_

  - [x] 5.5 Update TypeScript types
    - Modify `backend/src/types/index.ts` Seller interface
    - Change `visitDate` to TIMESTAMP type
    - Remove `visitTime` field
    - Update frontend types accordingly
    - _Requirements: 型定義の更新_

  - [ ] 5.6 Run database migration
    - Execute `backend/migrations/migrate-visit-date-to-timestamp.sql` on production database
    - Verify all existing data is migrated correctly
    - Check that no data is lost during migration
    - _Requirements: データベースマイグレーションの実行_

- [ ] 6. Checkpoint - Verify TIMESTAMP migration
  - Run all tests to ensure TIMESTAMP型への移行が正しく動作することを確認
  - Verify AA13729 displays `2026/04/04 10:00` in CallModePage
  - Verify AA13729 appears in 訪問日前日 sidebar category
  - Ask user if questions arise
