# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 訪問事前通知メール担当の定期同期欠落
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: `fetchAllSellersFromSupabase_` の戻り値に `visit_reminder_assignee` キーが存在しないことを確認（未修正コードで失敗）
  - `gas/seller-sync-clean.gs` の `fetchAllSellersFromSupabase_` を実行し、戻り値のオブジェクトに `visit_reminder_assignee` キーが含まれないことを確認
  - `syncUpdatesToSupabase_` を CV列に値がある売主（例: AA13677）で実行し、`updateData` に `visit_reminder_assignee` が含まれないことを確認
  - AA13677 の DB の `visit_reminder_assignee` が `null` のままであることを Supabase で確認
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: `fetchAllSellersFromSupabase_` の戻り値に `visit_reminder_assignee` キーが存在しない / `syncUpdatesToSupabase_` のログに `visit_reminder_assignee` が出力されない
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既存11フィールドの同期動作保全
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (既存11フィールドの差分チェック)
  - `status`, `next_call_date`, `visit_assignee`, `unreachable_status`, `comments`, `phone_contact_person`, `preferred_contact_time`, `contact_method`, `contract_year_month`, `current_status`, `pinrich_status` の差分チェックが正常に動作することを確認
  - 任意の売主データで `syncUpdatesToSupabase_` を実行し、既存フィールドの `updateData` が正しく構築されることを確認
  - Write property-based tests: 既存11フィールドのいずれかに差分がある場合、`updateData` に該当フィールドが含まれることを確認（未修正コードで PASS）
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Fix for 訪問事前通知メール担当（visit_reminder_assignee）定期同期欠落

  - [x] 3.1 Implement the fix
    - `gas/seller-sync-clean.gs` の `fetchAllSellersFromSupabase_` 内の `fields` 変数末尾に `,visit_reminder_assignee` を追加
    - `gas/seller-sync-clean.gs` の `syncUpdatesToSupabase_` 内の `pinrich_status` 差分チェックブロックの直後に `visit_reminder_assignee` の差分チェックブロックを追加
    - 追加コード: `var sheetVisitReminder = row['訪問事前通知メール担当'] ? String(row['訪問事前通知メール担当']) : null;` / `var dbVisitReminder = dbSeller.visit_reminder_assignee || null;` / `if (sheetVisitReminder !== dbVisitReminder) { updateData.visit_reminder_assignee = sheetVisitReminder; needsUpdate = true; }`
    - 既存の `syncVisitReminderAssignee()` および `unreachable_status`・`pinrich_status` の実装パターンと一致させる
    - _Bug_Condition: isBugCondition(input) — input.trigger IN ['10min_scheduled', 'manual_syncSellerList'] AND input.sheetColumn '訪問事前通知メール担当' HAS_VALUE AND NOT input.updateData CONTAINS 'visit_reminder_assignee'_
    - _Expected_Behavior: syncUpdatesToSupabase_ が visit_reminder_assignee の差分を検出し Supabase に PATCH する_
    - _Preservation: 既存11フィールド（status, next_call_date, visit_assignee, unreachable_status, comments, phone_contact_person, preferred_contact_time, contact_method, contract_year_month, current_status, pinrich_status）の差分チェックと更新処理は変わらない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 訪問事前通知メール担当の定期同期
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - `fetchAllSellersFromSupabase_` の戻り値に `visit_reminder_assignee` キーが含まれることを確認
    - AA13677 など CV列に値がある売主で `syncUpdatesToSupabase_` を実行し、DB の `visit_reminder_assignee` が更新されることを確認
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存11フィールドの同期動作保全
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - 既存11フィールドの差分チェックが修正前後で同一の結果を返すことを確認
    - CV列が空欄の場合、`visit_reminder_assignee` が `null` に更新されることを確認
    - DB値とシート値が同じ場合、`needsUpdate` が true にならないことを確認

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが PASS していることを確認
  - `syncSellerList` を実行し、AA13677 の `visit_reminder_assignee` が DB に反映されることを確認
  - `syncVisitReminderAssignee()`（手動一括同期）と `syncUpdatesToSupabase_`（定期同期）の結果が一致することを確認
  - 疑問点があればユーザーに確認する
