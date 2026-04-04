# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 任意の2文字アルファベットプレフィックス検索
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that `searchSellers` with `FI123`, `BB456`, `CC789` returns matching sellers (from Bug Condition in design)
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - AAプレフィックス検索の継続動作
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that `AA13501` search continues to work correctly
  - Test that invalid formats (`A123`, `ABC123`, `12345`) continue to not match regex
  - Test that non-seller-number searches (name, address) continue to work correctly
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 売主番号プレフィックス検索対応

  - [x] 3.1 Implement the fix in `backend/src/services/SellerService.supabase.ts`
    - 正規表現を`/^aa\d+$/i`から`/^[a-z]{2}\d+$/i`に変更（1543行目）
    - プレフィックス抽出ロジックを汎用化: `replace(/^AA/i, '')`を`replace(/^[a-z]{2}/i, '')`に変更（1548行目）
    - プレフィックス取得ロジックを追加: `const prefix = upperQuery.match(/^[a-z]{2}/i)?.[0] || 'AA';`（1549行目の前）
    - ゼロパディングロジックを汎用化: `` `AA${numPart.padStart(5, '0')}` ``を`` `${prefix}${numPart.padStart(5, '0')}` ``に変更（1549行目）
    - コメントを更新: `// AA12903のような形式の場合`を`// AA12903、FI123、BB456のような形式の場合`に変更（1544-1545行目）
    - _Bug_Condition: isBugCondition(input) where input matches /^[a-z]{2}\d+$/i AND NOT /^aa\d+$/i_
    - _Expected_Behavior: expectedBehavior(result) from design - SHALL match regex and return matching sellers_
    - _Preservation: Preservation Requirements from design - AA prefix, invalid formats, non-seller-number searches_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 任意の2文字アルファベットプレフィックス検索
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3, 2.4)_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - AAプレフィックス検索の継続動作
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: Preservation Requirements from design (3.1, 3.2, 3.3, 3.4)_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix for ゼロパディング済み売主番号の検索対応

  - [x] 5.1 Implement the fix in `backend/src/services/SellerService.supabase.ts`
    - 前方一致検索でOR条件を使用（1575-1589行目）
    - 数字部分が5桁未満の場合、ゼロパディングありとなしの両方で検索
    - 例: FI6 → FI6%（FI2にマッチ）またはFI00006%（FI00006にマッチ）
    - _Bug_Condition: FI6で検索すると、FI00006（ゼロパディング済み）が見つからない_
    - _Expected_Behavior: FI6で検索すると、FI6とFI00006の両方が見つかる_
    - _Preservation: AA検索、完全一致検索は引き続き正常に動作する_

  - [x] 5.2 Verify fix with test script
    - テストスクリプト作成: `backend/test-fi6-search-fix.ts`
    - FI6検索: FI00006が見つかることを確認
    - FI2検索: FI2とFI00002の両方が見つかることを確認
    - AA13501検索（回帰テスト）: 正常に動作することを確認
    - **EXPECTED OUTCOME**: 全てのテストがPASS

  - [x] 5.3 Deploy to production
    - コミット: cf55f71b
    - プッシュ: main
    - Vercel自動デプロイ: 進行中

- [x] 6. Final verification in production
  - **✅ マイグレーションSQL修正完了**: `cancellation_notice` → `cancel_notice_assignee`に修正
  - **✅ マイグレーション実行完了**: Supabase SQL Editorで実行済み
  - **✅ GAS同期完了**: AA13846とFI00006を同期済み
  - **✅ 本番環境で動作確認完了**:
    - 「FI6」で検索 → FI00006が表示される ✅
    - 「FI2」で検索 → FI2とFI00002が表示される ✅
    - 「AA13501」で検索 → 正常に動作する（回帰テスト）✅
