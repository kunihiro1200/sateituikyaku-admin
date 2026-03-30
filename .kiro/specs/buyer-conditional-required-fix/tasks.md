# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 持家ヒアリング結果の無条件必須バグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: `owned_home_hearing_inquiry = null` かつ `reception_date = "2026-04-01"` の具体的なケースでバグを確認
  - `isHomeHearingResultRequired({ owned_home_hearing_inquiry: null, reception_date: "2026-04-01" })` が `false` を返すことを確認
  - ボタン選択解除時のコールバックで `owned_home_hearing_inquiry` が空欄でも `owned_home_hearing_result` が `missingRequiredFields` に追加されることを確認
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - owned_home_hearing_inquiry に値がある場合の必須チェック動作の保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `owned_home_hearing_inquiry = "Y"` かつ `reception_date = "2026-04-01"` → `isHomeHearingResultRequired` が `true` を返す（未修正コードで確認）
  - Observe: `owned_home_hearing_inquiry = "Y"` かつ `reception_date = "2026-03-01"` → `isHomeHearingResultRequired` が `false` を返す（未修正コードで確認）
  - Write property-based test: `owned_home_hearing_inquiry` に値があり受付日が2026/3/30以降の場合、`isHomeHearingResultRequired` が `true` を返すことを検証
  - Write property-based test: 受付日が2026/3/30より前の場合、`isHomeHearingResultRequired` が `false` を返すことを検証
  - Write property-based test: `distribution_type` 等の他の必須フィールドのバリデーションが影響を受けないことを検証
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for owned_home_hearing_result の条件付き必須バグ

  - [x] 3.1 Implement the fix
    - `BuyerDetailPage.tsx` の `owned_home_hearing_result` ボタン選択解除時のコールバックを修正
    - ボタン選択解除時（`newValue = ''`）に `next.add('owned_home_hearing_result')` を実行する前に `isHomeHearingResultRequired(buyer)` を確認する
    - `owned_home_hearing_inquiry` が空欄の場合は `next.add` を実行しない
    - Pythonスクリプト（`fix_buyer_conditional_required.py`）を使用してUTF-8安全に編集する
    - _Bug_Condition: isBugCondition(data) where data.owned_home_hearing_inquiry IS NULL OR TRIM = ''_
    - _Expected_Behavior: isHomeHearingResultRequired(buyer) が false の場合、owned_home_hearing_result を missingRequiredFields に追加しない_
    - _Preservation: owned_home_hearing_inquiry に値がある場合の必須チェック動作は変更なし_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 持家ヒアリング結果の条件付き必須
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存の必須チェック動作の保持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
