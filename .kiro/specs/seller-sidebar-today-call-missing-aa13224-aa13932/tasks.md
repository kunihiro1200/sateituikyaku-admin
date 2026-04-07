# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - seller_sidebar_countsテーブルの古いデータによる不一致
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: seller_sidebar_countsテーブルのtodayCallカウント（21件）と、getSidebarCountsFallback()が計算する正しいカウント（23件以上）の不一致を検証
  - Test implementation details from Bug Condition in design
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他のサイドバーカテゴリの表示維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for seller_sidebar_countsテーブルの削除とgetSidebarCountsFallback()の常時使用

  - [x] 3.1 Implement the fix
    - getSidebarCounts()メソッドを修正して、seller_sidebar_countsテーブルからの取得を削除し、直接getSidebarCountsFallback()を呼び出すように変更
    - seller_sidebar_countsテーブルをSupabaseから削除（SQLコマンド: DROP TABLE IF EXISTS seller_sidebar_counts;）
    - GASの同期ロジック（updateSidebarCounts_()関数）を削除または無効化
    - getSidebarCounts()メソッドに、なぜgetSidebarCountsFallback()を直接呼び出すかの説明コメントを追加
    - _Bug_Condition: isBugCondition(input) where seller_sidebar_counts_table.todayCall != COUNT(sellers WHERE status IN ['追客中', '他決→追客'] AND next_call_date <= TODAY AND visit_assignee IS NULL OR visit_assignee = '' OR visit_assignee = '外す' AND phone_contact_person IS NULL OR phone_contact_person = '' AND preferred_contact_time IS NULL OR preferred_contact_time = '' AND contact_method IS NULL OR contact_method = '')_
    - _Expected_Behavior: expectedBehavior(result) from design - 「当日TEL」カテゴリの条件を満たす全ての売主が正しく表示され、カウントが正確に計算される_
    - _Preservation: Preservation Requirements from design - 他のサイドバーカテゴリのカウントと表示が正しく維持される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 当日TELカテゴリの正確な表示
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design - 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のサイドバーカテゴリの表示維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
