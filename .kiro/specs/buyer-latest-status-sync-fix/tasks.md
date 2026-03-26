# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - latest_status保存時にforce=trueが渡されていない
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: `handleInlineFieldSave('latest_status', 'B')`を呼んだ際に`buyerApi.update`が`{ sync: true, force: true }`で呼ばれることを確認するテストを書く
  - `buyerApi.update`をモックし、呼び出し時のオプションを記録する
  - 未修正コードでは`force`が含まれないため、テストはFAILする（これがバグの証拠）
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS（`force: true`が渡されていないことを確認）
  - Document counterexamples found: `buyerApi.update`が`{ sync: true }`のみで呼ばれる
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - latest_status以外のフィールドの保存動作
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `handleInlineFieldSave('latest_viewing_date', '2026-04-01')`が`{ sync: false }`で呼ばれることを未修正コードで確認
  - Observe: `handleInlineFieldSave('viewing_time', '14:00')`が`{ sync: false }`で呼ばれることを未修正コードで確認
  - Write property-based test: `latest_status`以外の任意のフィールドに対して、`force`が渡されないことを確認
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS（他フィールドの動作が正常であることを確認）
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix for BuyerViewingResultPageのlatest_status保存バグ

  - [x] 3.1 Implement the fix
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`の`handleInlineFieldSave`を修正
    - `{ sync: isLatestStatus }`を`{ sync: isLatestStatus, force: isLatestStatus }`に変更
    - 日本語を含むファイルのためPythonスクリプトで編集すること（file-encoding-protection.mdのルールに従う）
    - _Bug_Condition: isBugCondition(input) where input.page='BuyerViewingResultPage' AND input.fieldName='latest_status' AND force NOT IN options_
    - _Expected_Behavior: buyerApi.update called with { sync: true, force: true } for latest_status_
    - _Preservation: 他フィールドは { sync: false } のまま変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - latest_status保存時にforce=trueが渡される
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES（`force: true`が渡されることを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - latest_status以外のフィールドの保存動作
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS（他フィールドの動作が変わっていないことを確認）
    - Confirm all tests still pass after fix (no regressions)

- [-] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - git add, commit, push origin main でデプロイ
