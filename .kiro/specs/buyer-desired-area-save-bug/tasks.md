# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 希望エリアフィールドのドロップダウンを閉じずに保存
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
  - **Property 2: Preservation** - 他のフィールドの保存動作と配信メール「要」時の必須バリデーション
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 希望エリアフィールド保存バグ

  - [x] 3.1 Implement the fix
    - `onChange`イベントで即座に`handleFieldChange('desired_area', selected.join('|'))`を呼び出す
    - `onClose`イベントハンドラーを削除または簡略化する
    - チップ削除時の`handleFieldChange`呼び出しが正しく動作することを確認
    - `selectedAreasRef.current`の更新タイミングを確認
    - _Bug_Condition: isBugCondition(input) where (input.action === 'select' AND NOT input.dropdownClosed AND input.saveButtonPressed) OR (input.action === 'chipDelete' AND input.saveButtonPressed AND selectedAreasRef.current !== selectedAreas)_
    - _Expected_Behavior: onChange イベントで即座に pendingChanges に反映され、ドロップダウンの開閉状態に関係なく保存される_
    - _Preservation: 他のフィールドの保存動作、配信メール「要」時の必須バリデーション、ドロップダウンを閉じた後の保存動作_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 希望エリアフィールドのドロップダウンを閉じずに保存
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のフィールドの保存動作と配信メール「要」時の必須バリデーション
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
