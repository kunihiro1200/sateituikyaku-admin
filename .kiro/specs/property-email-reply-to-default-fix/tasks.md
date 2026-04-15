# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - jimuStaff空配列時のreplyToデフォルト設定失敗
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: jimuStaff=[]の状態でhandleOpenEmailDialogを呼び出し、replyToが空欄のままであることを確認
  - Test: jimuStaff=[]の状態でhandleOpenEmailDialogを呼び出す → emailDialog.openがtrueになった後もreplyToが空欄のまま（Bug Conditionより）
  - Test: jimuStaff=[]の状態でhandleSelectPropertyEmailTemplateを呼び出す → 同様にreplyToが空欄のまま
  - The test assertions should match the Expected Behavior Properties from design: emailDialog.openがtrueかつjimuStaff.length>0のとき、sales_assigneeに対応するメールがreplyToに設定されること
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 非バグ条件下での既存動作保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: ユーザーが返信先ドロップダウンで別スタッフを選択した後、その選択が維持される（未修正コードで確認）
  - Observe: 送信完了・キャンセル後にreplyToが空欄にリセットされる（未修正コードで確認）
  - Observe: handleSelectPropertyEmailTemplateでテンプレートの件名・本文が正しく設定される（未修正コードで確認）
  - Observe: sales_assigneeに対応するスタッフが存在しない場合、replyToが空欄のまま（未修正コードで確認）
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. Fix for emailDialog.open時のreplyToデフォルト設定バグ

  - [x] 3.1 Implement the fix
    - `handleOpenEmailDialog` から `replyTo` 設定ロジック（matchedStaff/setReplyTo行）を削除
    - `handleSelectPropertyEmailTemplate` から `replyTo` 設定ロジック（matchedStaff/setReplyTo行）を削除
    - `emailDialog.open` を監視する `useEffect` を追加（fetchJimuStaff関数の近くに配置）:
      ```typescript
      useEffect(() => {
        if (emailDialog.open && jimuStaff.length > 0) {
          const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);
          setReplyTo(matchedStaff?.email || '');
        }
      }, [emailDialog.open, jimuStaff, data?.sales_assignee]);
      ```
    - _Bug_Condition: isBugCondition(input) where input.dialogOpenEvent IN ['handleOpenEmailDialog', 'handleSelectPropertyEmailTemplate'] AND input.jimuStaffAtCallTime.length === 0_
    - _Expected_Behavior: emailDialog.openがtrueかつjimuStaff.length>0のとき、sales_assigneeに対応するスタッフのメールアドレスがreplyToに設定される_
    - _Preservation: 手動選択・リセット・テンプレート内容設定・対応スタッフなし時の空欄維持は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - jimuStaff取得後のreplyToデフォルト設定
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 非バグ条件下での既存動作保持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
