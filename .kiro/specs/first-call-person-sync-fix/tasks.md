# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 1番電話フィールドの同期失敗
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `row['一番TEL']` always returns `undefined` when the actual spreadsheet column is `'1番電話'`
  - Verify that `syncSingleSeller` / `updateSingleSeller` do NOT save `first_call_person` to DB when `row['1番電話'] = 'Y'` (from Bug Condition in design)
  - Verify that `detectUpdatedSellers` does NOT detect a diff when DB has `first_call_person = 'Y'` and sheet has `'1番電話' = 'I'`
  - The test assertions should match the Expected Behavior Properties from design: `row['1番電話']` value is saved as `first_call_person`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., `row['一番TEL']` is `undefined` so `first_call_person` is never set)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他フィールドの同期動作維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false)
  - Observe: `syncSingleSeller` correctly saves `phone_contact_person` from `row['電話担当（任意）']`
  - Observe: `syncSingleSeller` correctly saves `preferred_contact_time` from `row['連絡取りやすい日、時間帯']`
  - Observe: `syncSingleSeller` correctly saves `contact_method` from `row['連絡方法']`
  - Observe: `column-mapping.json` `databaseToSpreadsheet` maps `first_call_person` → `"一番TEL"` (unchanged)
  - Write property-based tests: for all rows, `phone_contact_person` / `preferred_contact_time` / `contact_method` sync correctly (from Preservation Requirements in design)
  - Write test: `databaseToSpreadsheet` section still maps `first_call_person` to `"一番TEL"`
  - Write test: when `row['1番電話']` is empty/null, `first_call_person` is set to null/undefined (same as before fix)
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 1番電話フィールドの同期バグ（カラム名不一致）

  - [x] 3.1 Implement the fix
    - **File 1**: `backend/src/config/column-mapping.json` の `spreadsheetToDatabase` セクション
      - `"一番TEL": "first_call_person"` → `"1番電話": "first_call_person"` に変更
      - `databaseToSpreadsheet` セクションの `"first_call_person": "一番TEL"` は変更しない
    - **File 2**: `backend/src/services/EnhancedAutoSyncService.ts` の3箇所
      - `syncSingleSeller` メソッド: `row['一番TEL']` → `row['1番電話']`
      - `updateSingleSeller` メソッド: `row['一番TEL']` → `row['1番電話']`
      - `detectUpdatedSellers` メソッド: `sheetRow['一番TEL']` → `sheetRow['1番電話']`
    - **重要**: 日本語を含むファイルの編集はPythonスクリプトを使用してUTF-8で書き込む（`file-encoding-protection.md` ルール準拠）
    - _Bug_Condition: isBugCondition(row) where row['1番電話'] IS NOT undefined/null/'' AND row['一番TEL'] IS undefined_
    - _Expected_Behavior: row['1番電話'] の値が first_call_person としてDBに保存・更新される_
    - _Preservation: databaseToSpreadsheet の "first_call_person": "一番TEL" は変更しない。他フィールド（phone_contact_person, preferred_contact_time, contact_method）の同期処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 1番電話フィールドの同期成功
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他フィールドの同期動作維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - デプロイ: `git add . && git commit -m "fix: 1番電話フィールドの同期バグ修正（カラム名不一致）" && git push origin main`
