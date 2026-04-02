# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 「内覧前伝達事項」が挿入されないバグの再現
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
  - **Property 2: Preservation** - 既存動作の維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 買主テンプレート「内覧前伝達事項」挿入バグ

  - [x] 3.1 Implement the fix
    - `BuyerDetailPage.tsx`の`SmsDropdownButton`のpropsを修正: `preViewingNotes={buyer.pre_viewing_notes || ''}`を`preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}`に変更
    - `BuyerDetailPage.tsx`の`BuyerGmailSendButton`のpropsを修正: `preViewingNotes={buyer.pre_viewing_notes || ''}`を`preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}`に変更
    - コードコメントの追加: 修正箇所に「物件リストテーブルから取得」というコメントを追加
    - _Bug_Condition: isBugCondition(input) where input.linkedProperties.length > 0 AND input.linkedProperties[0].pre_viewing_notes IS NOT NULL AND input.linkedProperties[0].pre_viewing_notes != ''_
    - _Expected_Behavior: expectedBehavior(result) from design - SMS/Gmailメッセージに物件リストテーブルの「内覧前伝達事項」が正しく挿入される_
    - _Preservation: Preservation Requirements from design - 「資料請求～」以外のテンプレート選択時、および「内覧前伝達事項」が空の場合の既存動作が維持される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 「内覧前伝達事項」が正しく挿入される
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design - 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存動作の維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
