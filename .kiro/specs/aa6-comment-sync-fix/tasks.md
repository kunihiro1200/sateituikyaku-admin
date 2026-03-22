# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - commentsフィールドのmapToSheetマッピング欠落
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: `comments` に非空文字列を持つ `SellerData` を `mapToSheet()` に渡す
  - Test that `ColumnMapper.mapToSheet({ comments: "テストコメント", name: "テスト", ... })` returns a `SheetRow` where `sheetRow['コメント'] === "テストコメント"` (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design (Property 1: 2.1, 2.2)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., `sheetRow['コメント']` が `undefined` または空文字になる)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [~] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - コメント以外のフィールドのmapToSheetマッピング保全
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `comments` is null or empty)
  - Observe: `mapToSheet({ status: "追客中", name: "テスト", comments: null, ... })` returns correct `SheetRow` for all non-comments fields
  - Write property-based tests: for all `SellerData` inputs, `status`・`next_call_date`・`visit_assignee` などのフィールドのマッピング結果が `comments` フィールドの値に関わらず変わらないことを確認 (from Preservation Requirements in design)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 3. Fix for commentsフィールドのDB→スプレッドシート同期欠落

  - [x] 3.1 Implement the fix
    - 探索的テスト（タスク1）の結果に基づき根本原因を特定する
    - ケースA: `column-mapping.json` の `databaseToSpreadsheet` に `comments` が欠落している場合 → `"comments": "コメント"` を追加
    - ケースB: `ColumnMapper.mapToSheet()` が `comments` を除外するロジックがある場合 → 除外ロジックを修正
    - ケースC: スプレッドシートのヘッダー名と `column-mapping.json` の値が一致していない場合 → ヘッダー名を修正
    - 修正は最小限の変更に留め、他フィールドの同期に影響を与えない
    - _Bug_Condition: `isBugCondition(input)` where `input.comments IS NOT NULL AND input.comments IS NOT EMPTY AND sheetRow['コメント'] IS NULL OR sheetRow['コメント'] = ''`_
    - _Expected_Behavior: `mapToSheet(input)` returns `SheetRow` where `sheetRow['コメント'] === input.comments` for all non-empty comments_
    - _Preservation: `comments` 以外の全フィールドのマッピング結果は修正前後で変わらない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - commentsフィールドのmapToSheetマッピング
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - コメント以外のフィールドのmapToSheetマッピング保全
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
