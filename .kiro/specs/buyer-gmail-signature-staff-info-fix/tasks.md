# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 担当者情報プレースホルダーが空文字になるバグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - `backend/src/services/__tests__/EmailTemplateService.bugfix.test.ts` に以下のテストを追加する
  - `mergeAngleBracketPlaceholders` に `<<担当名（営業）電話番号>>` を含むテキストを渡す
  - `staffInfo` パラメータが存在しない（未修正コード）ため、プレースホルダーが空文字に置換されることを確認する
  - 同様に `<<担当名（営業）メールアドレス>>`、`<<担当名（営業）固定休>>` も確認する
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: `<<担当名（営業）電話番号>>` が空文字に置換される（staffInfo パラメータが存在しないため）
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既存プレースホルダー置換の維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs（担当者情報プレースホルダーを含まないテンプレート）
  - `backend/src/services/__tests__/EmailTemplateService.bugfix.test.ts` に以下のテストを追加する
  - `<<氏名>>`、`<<買主番号>>`、`<<メールアドレス>>` の置換が未修正コードで正常に動作することを確認する
  - `<<住居表示>>`、`<<GoogleMap>>` の置換が未修正コードで正常に動作することを確認する
  - `staffInfo` なしの場合（または null の場合）、担当者情報プレースホルダーが空文字に置換されることを確認する
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for 買主Gmail署名の担当者情報（TEL・MAIL・固定休）が空欄になるバグ

  - [x] 3.1 Implement the fix
    - **File 1**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx`
      - `BuyerGmailSendButtonProps` interface に `followUpAssignee?: string` を追加する
      - `handleTemplateSelect` 内の `mergeMultiple` リクエストの `buyer` オブジェクトに `follow_up_assignee: followUpAssignee || ''` を追加する
    - **File 2**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`
      - `<BuyerGmailSendButton>` に `followUpAssignee={buyer.follow_up_assignee || ''}` prop を追加する
    - **File 3**: `backend/src/routes/emailTemplates.ts`
      - `POST /:templateId/mergeMultiple` エンドポイントで `buyer.follow_up_assignee` を取得する
      - `follow_up_assignee` が存在する場合、`staffService.getStaffByInitials()` でスタッフを検索する
      - 見つからない場合は `staffService.getStaffByNameContains()` で部分一致検索する
      - 取得した `staffInfo` を `mergeAngleBracketPlaceholders` の呼び出しに渡す（物件なしの場合も含む）
    - **File 4**: `backend/src/services/EmailTemplateService.ts`
      - `mergeAngleBracketPlaceholders` にオプションパラメータ `staffInfo?: { name?: string; phone?: string | null; email?: string | null; regularHoliday?: string | null } | null` を追加する
      - `<<[^>]*>>` による空文字置換の前に以下の置換処理を追加する：
        - `<<担当名（営業）名前>>` → `staffInfo?.name || ''`
        - `<<担当名（営業）電話番号>>` → `staffInfo?.phone || ''`
        - `<<担当名（営業）メールアドレス>>` → `staffInfo?.email || ''`
        - `<<担当名（営業）固定休>>` → `staffInfo?.regularHoliday || ''`
      - 両方のコードパス（物件あり・物件なし）に同じ置換処理を追加する
    - _Bug_Condition: isBugCondition(input) where input.templateBody CONTAINS '<<担当名（営業）電話番号>>' OR '<<担当名（営業）メールアドレス>>' OR '<<担当名（営業）固定休>>' AND buyerFollowUpAssignee IS undefined OR mergeAngleBracketPlaceholders DOES NOT handle these placeholders_
    - _Expected_Behavior: 後続担当のスタッフ情報を取得して各プレースホルダーを実際の値で置換する_
    - _Preservation: 買主情報・物件情報プレースホルダーの置換は引き続き正常に動作する。follow_up_assignee なしの場合は空文字に置換される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 担当者情報プレースホルダーが正しく置換される
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存プレースホルダー置換の維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - `backend/src/services/__tests__/EmailTemplateService.bugfix.test.ts` の全テストが PASS することを確認する
  - `backend/src/routes/__tests__/emailTemplates.test.ts` の既存テストが引き続き PASS することを確認する
  - TypeScript の型エラーがないことを確認する（`getDiagnostics` で確認）
