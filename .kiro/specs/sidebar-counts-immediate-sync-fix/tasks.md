# Implementation Plan

## 優先順位

1. サイドバーカウント更新サービスの作成
2. BuyerServiceとSellerServiceへの統合
3. キャッシュ無効化の実装
4. テストの作成と実行

---

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - サイドバーカウント即時反映
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
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - GAS同期の維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for サイドバーカウント即時反映

  - [x] 3.1 サイドバーカウント更新サービスの作成
    - `backend/src/services/SidebarCountsUpdateService.ts`を新規作成
    - 買主サイドバーカウント更新メソッド: `updateBuyerSidebarCounts(buyerId: string)`
    - 売主サイドバーカウント更新メソッド: `updateSellerSidebarCounts(sellerId: string)`
    - 差分更新ロジック: 更新前後のカテゴリー所属を比較し、増減のみを反映
    - Redisキャッシュ無効化: `CacheHelper.del('buyers:sidebar-counts')`および`CacheHelper.del('sellers:sidebar-counts')`
    - _Bug_Condition: isBugCondition(input) where input.field IN ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender', 'visit_assignee', 'visit_date', 'status']_
    - _Expected_Behavior: sidebarCountsUpdatedImmediately(result) from design_
    - _Preservation: GAS同期が正しく動作し続けること_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 BuyerServiceへの統合
    - `backend/src/services/BuyerService.ts`の`update()`メソッドを修正
    - データベース更新後、`SidebarCountsUpdateService.updateBuyerSidebarCounts(id)`を呼び出す
    - 非同期実行（`await`なし、エラーハンドリングのみ）
    - 条件付き実行: サイドバーカテゴリーに影響するフィールドが更新された場合のみ実行
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 SellerServiceへの統合
    - `backend/src/services/SellerService.supabase.ts`の`updateSeller()`メソッドを修正
    - データベース更新後、`SidebarCountsUpdateService.updateSellerSidebarCounts(sellerId)`を呼び出す
    - 非同期実行（`await`なし、エラーハンドリングのみ）
    - 条件付き実行: サイドバーカテゴリーに影響するフィールドが更新された場合のみ実行
    - _Requirements: 2.3_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - サイドバーカウント即時反映
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - GAS同期の維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
