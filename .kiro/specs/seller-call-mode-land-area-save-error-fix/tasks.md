# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 土地面積（当社調べ）保存時のスキーマエラー
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
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他フィールド保存の継続動作
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for 土地面積（当社調べ）保存エラー

  - [x] 3.1 Implement the fix
    - `PropertyService.ts`の`mapToPropertyInfo()`メソッドから`data.address`のフォールバック参照を削除
    - 現在: `address: data.property_address || data.address` → 修正後: `address: data.property_address`
    - Geocoding API呼び出し時に`property_address`カラムを参照するように修正（該当箇所がある場合）
    - エラーハンドリングを追加（スキーマエラー発生時に適切なエラーメッセージを表示）
    - _Bug_Condition: isBugCondition(input) where input.fieldName == 'land_area_verified' AND input.value > 0 AND input.action == 'save' AND propertiesTableHasNoAddressColumn()_
    - _Expected_Behavior: expectedBehavior(result) from design - システムは正しいカラム名（property_address）を使用してデータベースに保存し、成功メッセージを表示する_
    - _Preservation: Preservation Requirements from design - 他のフィールド（土地面積、建物面積など）の保存、およびproperty_addressを正しく使用している既存機能が引き続き正常に動作する_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 土地面積（当社調べ）保存成功
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design - 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他フィールド保存の継続動作
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
