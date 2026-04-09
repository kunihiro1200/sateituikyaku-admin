# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 複数アルファベット文字列の連結表示
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `extractStatusAlpha("B:内覧した物件はNGだが...")` returns "B" (not "BNG")
  - Test that `extractStatusAlpha("C:NGだが連絡は取れる")` returns "C" (not "CNG")
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 単一アルファベット文字列の表示
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Observe: `extractStatusAlpha("A")` returns "A" on unfixed code
  - Observe: `extractStatusAlpha("B")` returns "B" on unfixed code
  - Observe: `extractStatusAlpha(null)` returns "-" on unfixed code
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 買主候補リスト表示の不具合

  - [x] 3.1 Implement the fix
    - `frontend/frontend/src/pages/BuyerCandidateListPage.tsx`の`extractStatusAlpha`関数を修正
    - 正規表現のgフラグを削除して最初のアルファベット1文字のみを抽出（`/[A-Za-z]/`）
    - 配列の連結を削除して`match[0]`で最初の要素のみを返す
    - シンプルな実装として`status.charAt(0)`を使用
    - nullチェックを保持（`if (!status) return '-';`）
    - _Bug_Condition: isBugCondition(input) where input.latest_status contains multiple alphabet strings (e.g., "B:内覧した物件はNGだが...")_
    - _Expected_Behavior: expectedBehavior(result) from design - returns first character only_
    - _Preservation: Preservation Requirements from design - single alphabet strings and null values unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 複数アルファベット文字列の最初の1文字のみ表示
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 単一アルファベット文字列の表示保持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
