# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 「未入力」が物件住所として返されるバグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - `property.property_address = '未入力'` かつ `sellers.property_address = '大分市中央町1-1-1'` → 「未入力」が返されることを確認
    - `property.property_address = '未入力'` かつ `sellers.property_address = null` → 「未入力」が返されることを確認
    - `property.property_address = '未入力'` かつ `sellers.property_address = '未入力'` → 「未入力」が返されることを確認
  - `resolvedAddress` ロジックを単体でテストする（`backend/src/services/SellerService.supabase.ts` の `getSeller()` 内のロジックを抽出）
  - テストは `property.property_address || property.address` の最終フォールバックが「未入力」を返すことを確認する
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., `property_address='未入力'` の場合、最終フォールバックが「未入力」を返す)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 有効な `properties.property_address` はそのまま返される
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false):
    - Observe: `property_address = '大分市中央町1-1-1'` → 「大分市中央町1-1-1」が返される（バグなし）
    - Observe: `property_address = null`、`sellers.property_address = '大分市中央町1-1-1'` → 「大分市中央町1-1-1」が返される（バグなし）
    - Observe: `property_address = ''`、`sellers.property_address = '大分市中央町1-1-1'` → 「大分市中央町1-1-1」が返される（バグなし）
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all valid `property_address` values (non-empty, non-「未入力」): result equals `property_address`
    - For null/empty `property_address` with valid `sellers.property_address`: result equals `sellers.property_address`
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 3. Fix for `resolvedAddress` 最終フォールバックが「未入力」を返すバグ

  - [x] 3.1 Implement the fix in `backend/src/services/SellerService.supabase.ts`
    - `getSeller()` メソッド内の `resolvedAddress` ロジックを修正する
    - 不要な `property.address` 参照を削除する（`properties` テーブルに `address` カラムは存在しない）
    - 最終フォールバックを `null` に変更する（「未入力」という文字列を返さないようにする）
    - 修正前: `property.property_address || property.address`（「未入力」をそのまま返す）
    - 修正後: `null`（全て無効な場合は null を返す）
    - 完全な修正後コード:
      ```typescript
      const resolvedAddress =
        isValidAddress(property.property_address) ? property.property_address :
        isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
        null;
      ```
    - _Bug_Condition: `isBugCondition(input)` where `input.property_address.trim() == '未入力'` AND `resolvedAddress(input) == '未入力'`_
    - _Expected_Behavior: `getSeller()` returns `sellers.property_address` value (or null) when `properties.property_address` is '未入力'_
    - _Preservation: Valid `properties.property_address` values are returned unchanged; null/empty `property_address` falls back to `sellers.property_address`_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 「未入力」が物件住所として返されないこと
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 有効な `properties.property_address` はそのまま返される
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
