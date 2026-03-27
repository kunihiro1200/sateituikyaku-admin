# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - inquiry_site カラム名不一致バグ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: `data.site` が定義されている `UpdateSellerRequest` を対象にスコープを絞る
  - `updateSeller(id, { status: '追客中', site: 'ウ' })` を呼び出した場合に `updates.site = data.site` が実行され、Supabaseが `column "site" of relation "sellers" does not exist` エラーを返すことを確認する
  - 除外日計算クエリ `SELECT inquiry_date, site FROM sellers` も `site` カラム不存在でエラーになることを確認する
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS（バグの存在を証明する）
  - Document counterexamples found（例: `updateSeller(id, { site: 'ウ' })` → 500エラー）
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - site非含有更新の動作保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `updateSeller(id, { status: '専任媒介' })` が正常に動作することを未修正コードで確認する
  - Observe: `updateSeller(id, { confidence: 'A' })` が正常に動作することを未修正コードで確認する
  - Observe: `updateSeller(id, { nextCallDate: '2026-04-01' })` が正常に動作することを未修正コードで確認する
  - Write property-based test: `data.site` が `undefined` である全ての `UpdateSellerRequest` に対して、修正前後で同じ動作をすることを確認する
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS（ベースライン動作を確認する）
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for call-mode status update 500 error

  - [x] 3.1 Implement the fix - SellerService.updateSeller() のカラム名修正
    - `backend/src/services/SellerService.supabase.ts` の `// Site field` セクション（約543行目）を修正
    - `updates.site = data.site` → `updates.inquiry_site = data.site` に変更
    - 除外日計算クエリ `.select('inquiry_date, site')` → `.select('inquiry_date, inquiry_site')` に変更
    - `currentSeller?.site` → `currentSeller?.inquiry_site` に変更（約593行目）
    - _Bug_Condition: isBugCondition(input) where input.site IS NOT UNDEFINED AND updates.site = input.site_
    - _Expected_Behavior: updates.inquiry_site = data.site として正しいカラム名でSupabaseを更新し200レスポンスを返す_
    - _Preservation: data.site が undefined である全ての更新リクエストは修正前後で同じ動作をする_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Implement the fix - CallModePage.tsx のステータスセクションUI改善
    - `frontend/frontend/src/pages/CallModePage.tsx` に `statusChanged` state を追加
    - ステータスセクションのフィールド（状況（当社）、確度、次電日、除外日にすること）が初期値から変更された場合に `statusChanged = true` にする
    - 「ステータスを更新」ボタンを未変更時はグレーの `variant="outlined"`（disabled）、変更あり時はオレンジの `variant="contained"` + パルスアニメーションに変更
    - 保存成功後に `statusChanged = false` にリセットする
    - _Requirements: 2.3, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - inquiry_site カラム名修正後の動作確認
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - site非含有更新の動作保持確認
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS（リグレッションがないことを確認する）
    - Confirm all tests still pass after fix (no regressions)

- [-] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
