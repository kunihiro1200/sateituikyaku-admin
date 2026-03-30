# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 営担列の値がDBに反映されない
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
  - **Property 2: Preservation** - 空欄・「外す」の処理が保持される
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 営担列の同期バグ

  - [x] 3.1 Implement the fix using Python script
    - **IMPORTANT**: GASコードは日本語を含むため、Pythonスクリプトで編集すること
    - **DO NOT use strReplace** - 文字コード問題を回避するため
    - UTF-8エンコーディングを保持すること
    - Create Python script `fix_visit_assignee_sync.py`
    - Modify `rowToObject` function: ヘッダー名を正規化（trim処理）
      - `var headerName = String(headers[j]).trim();`
      - `if (headerName === '') continue;`
      - `obj[headerName] = val;`
    - Modify `syncUpdatesToSupabase_` function: visit_assignee の比較ロジック修正
      - `!rawVisitAssignee || rawVisitAssignee === '外す'` で falsy 値を全て捕捉
      - `sheetVisitAssignee = sheetVisitAssignee || null;` で正規化
      - `var dbVisitAssignee = dbSeller.visit_assignee || null;` で正規化
      - `if (sheetVisitAssignee !== dbVisitAssignee)` で比較
    - _Bug_Condition: isBugCondition(input) where input.spreadsheetRow['営担'] IS NOT EMPTY AND input.spreadsheetRow['営担'] != '外す' AND input.dbSeller.visit_assignee IS NULL_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 営担列の値がDBに正しく反映される
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 空欄・「外す」の処理が保持される
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Deploy to GAS
  - Copy modified `gas_complete_code.js` to GAS script editor
  - Verify the script is saved
  - Test with AA12497 (スプレッドシートの「営担」列に "Y" が入力されている売主)
  - Confirm `visit_assignee` is updated in DB

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
