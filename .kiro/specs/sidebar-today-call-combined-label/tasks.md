# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 複数コミュニケーション情報の結合表示バグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases (2つ以上のフィールドに値がある場合)
  - Test that `getTodayCallWithInfoLabel()` returns only one value when multiple fields are set (from Bug Condition in design)
  - isBugCondition: `validCount >= 2` (phone_contact_person, preferred_contact_time, contact_method のうち2つ以上に有効な値がある)
  - Expected behavior: 全ての有効な値を `・` で結合した `当日TEL(値1・値2)` 形式を返す
  - Concrete failing cases:
    - `{ phone_contact_person: "I", contact_method: "Eメール" }` → 現在は `当日TEL(Eメール)` を返す（バグ）、期待値: `当日TEL(I・Eメール)`
    - `{ phone_contact_person: "Y", preferred_contact_time: "午前中" }` → 現在は `当日TEL(午前中)` を返す（バグ）、期待値: `当日TEL(Y・午前中)`
    - `{ phone_contact_person: "I", preferred_contact_time: "午前中", contact_method: "Eメール" }` → 現在は `当日TEL(Eメール)` を返す（バグ）、期待値: `当日TEL(I・午前中・Eメール)`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (優先順位チェーンで最初の値のみ返している)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 単一コミュニケーション情報の表示
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (isBugCondition が false = 有効なフィールドが1つ以下)
  - Observe: `{ contact_method: "Eメール" }` → `当日TEL(Eメール)` on unfixed code
  - Observe: `{ preferred_contact_time: "午前中" }` → `当日TEL(午前中)` on unfixed code
  - Observe: `{ phone_contact_person: "Y" }` → `当日TEL(Y)` on unfixed code
  - Observe: `{}` (全フィールド空) → `当日TEL（内容）` on unfixed code
  - Write property-based tests: for all inputs where validCount <= 1, result equals the same as unfixed code (from Preservation Requirements in design)
  - Non-bug condition: `validCount < 2` (有効なフィールドが0または1つ)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4_

- [-] 3. Fix getTodayCallWithInfoLabel() in sellerStatusFilters.ts

  - [-] 3.1 Implement the fix
    - File: `frontend/frontend/src/utils/sellerStatusFilters.ts`
    - Function: `getTodayCallWithInfoLabel()`
    - 優先順位チェーンで最初の値のみ返す実装を削除する
    - 全ての有効な値を配列に収集して `・` で結合する実装に変更する
    - 表示順を定義: 電話担当（phone_contact_person）→ 連絡取りやすい時間（preferred_contact_time）→ 連絡方法（contact_method）
    - フォールバック維持: 有効な値が1つもない場合は `当日TEL（内容）` を返す
    - _Bug_Condition: isBugCondition(seller) where validCount >= 2 (phone_contact_person, preferred_contact_time, contact_method のうち2つ以上に有効な値がある)_
    - _Expected_Behavior: parts.join('・') で全ての有効な値を結合した `当日TEL(値1・値2...)` を返す_
    - _Preservation: 有効なフィールドが1つの場合は `当日TEL(値)` を返す、全て空の場合は `当日TEL（内容）` を返す_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 複数コミュニケーション情報の結合表示
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 単一コミュニケーション情報の表示
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - デプロイ: `git push origin main` でVercelに自動デプロイされる
