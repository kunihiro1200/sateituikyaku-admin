# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 建物価格マイナス・建築単価ハードコードバグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing cases:
    - 木造・築40年（buildYear=1985）・建物面積100㎡ → 建物価格がマイナスになることを確認
    - 木造・築33年（buildYear=1992）・建物面積100㎡ → 建物価格がマイナスになることを確認
    - 鉄骨・築45年（buildYear=1980）・建物面積100㎡ → 建築単価が176200円のままであることを確認
    - 築年=0・建物面積100㎡ → buildingAge=0で計算されることを確認（デフォルト35年が未適用）
  - Test file: `backend/src/tests/building-price-bug.test.ts`
  - isBugCondition: `structure IN ['木造','','null'] AND buildingAge >= 33` OR `structure IN ['鉄骨','軽量鉄骨'] AND buildingAge >= 40` OR `unitPrice === 176200`
  - The test assertions should match the Expected Behavior Properties from design (建物価格 >= basePrice * 0.1)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 土地価格計算の不変性・正常範囲の建物価格計算
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (築年数が上限未満のケース)
  - Test file: `backend/src/tests/building-price-preservation.test.ts`
  - Observe: 土地面積=100㎡、路線価=50000円 → 土地価格 = 100 × 50000 / 0.6 = 8,333,333円（修正前後で変わらない）
  - Observe: 木造・築20年（buildYear=2005）・建物面積100㎡ → 正の値が返ること
  - Observe: 鉄骨・築30年（buildYear=1995）・建物面積100㎡ → 正の値が返ること
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - 土地価格計算（landArea × roadPrice / 0.6）が修正前後で同一であること
    - 木造・築32年以下で建物価格が正の値であること（3.1）
    - 鉄骨/軽量鉄骨・築39年以下で建物価格が正の値であること（3.2）
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for 建物価格計算バグ（建築単価ハードコード・築年数上限チェックなし）

  - [x] 3.1 Implement the fix
    - File: `frontend/frontend/src/pages/CallModePage.tsx`（計算根拠セクション、約4793〜4810行付近）
    - 建物面積の優先順位を変更: `property.buildingAreaVerified || property.buildingArea || 0`
    - 築年数デフォルト値を変更: `buildYear > 0 ? 2025 - buildYear : 35`（0の場合は35年）
    - 建築単価を構造に応じた動的な値に変更:
      - 鉄骨: 237300円/㎡
      - 軽量鉄骨: 128400円/㎡
      - 木造・空欄・その他: 123100円/㎡
    - 築年数の上限チェックを追加:
      - 鉄骨・軽量鉄骨: 40年以上で `basePrice * 0.1`（残価10%）
      - 木造・空欄・その他: 33年以上で `basePrice * 0.1`（残価10%）
    - 計算根拠の表示テキスト（unitPrice・depreciation・buildingPriceの表示部分）も修正後の値を反映
    - _Bug_Condition: isBugCondition(input) where (structure IN ['木造',''] AND buildingAge >= 33) OR (structure IN ['鉄骨','軽量鉄骨'] AND buildingAge >= 40) OR unitPrice === 176200_
    - _Expected_Behavior: buildingPrice >= basePrice * 0.1 かつ buildingPrice > 0（全構造・全築年数）_
    - _Preservation: 土地価格計算（landArea × roadPrice / 0.6）は変更しない。計算根拠セクションの表示条件は変更しない。_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 建物価格マイナス・建築単価ハードコードバグ
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 (`backend/src/tests/building-price-bug.test.ts`)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 土地価格計算の不変性・正常範囲の建物価格計算
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 (`backend/src/tests/building-price-preservation.test.ts`)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - デプロイ: `git push origin main` で自動デプロイ
