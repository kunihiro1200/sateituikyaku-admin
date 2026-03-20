# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Phase 4 が WorkTaskSyncService.syncAll() を呼び出していない
  - **CRITICAL**: このテストは unfixed code で FAIL することが期待される — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 実装後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す counterexample を表面化する
  - **Scoped PBT Approach**: 具体的な失敗ケース（AA9195の「サイト登録締め日」）にスコープを絞る
  - スプレッドシートの AA9195 の「サイト登録締め日」の現在値を記録する
  - `runFullSync()` を実行し、Phase 4 のログを確認する（「Work task sync (handled by existing service)」が出力されるだけで何もしない）
  - DBの `work_tasks` テーブルで AA9195 の `site_registration_deadline` を確認し、スプレッドシートと一致しないことを確認する
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS（Phase 4 が何もしないため、DBに反映されない）
  - counterexample を記録して根本原因を理解する
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既存の手動同期APIの動作維持
  - **IMPORTANT**: observation-first methodology に従う
  - Observe: `POST /api/work-tasks/sync` が unfixed code で正常に動作することを確認
  - Observe: `POST /api/work-tasks/sync/AA9195` が unfixed code で正常に動作することを確認
  - Observe: `runFullSync()` で Phase 1〜3、4.5〜4.8、5 が正常に動作することを確認
  - 観察した動作をプロパティベーステストとして記録する
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS（既存APIは正常動作している）
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix: 業務依頼GASスクリプトの実装

  - [x] 3.1 GASスクリプトファイルを作成する
    - `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` を新規作成する
    - `gas/property-listing-sync/PropertyListingSync.gs` と同じパターンで実装する
    - CONFIG 設定:
      - `SPREADSHEET_ID`: `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g`
      - `SHEET_NAME`: `業務依頼`
      - `TABLE_NAME`: `work_tasks`
      - `BATCH_SIZE`: 100
      - `SYNC_INTERVAL_MINUTES`: 10
    - `work-task-column-mapping.json` の `spreadsheetToDatabase`、`spreadsheetToDatabase2`、`spreadsheetToDatabase3` を統合した `COLUMN_MAPPING` を定義する
    - `work-task-column-mapping.json` の `typeConversions` に基づく `TYPE_CONVERSIONS` を定義する
    - `syncGyomuWorkTasks()` メイン同期関数を実装する（物件番号が空の行はスキップ）
    - `upsertToSupabase()` を実装する（`on_conflict=property_number`）
    - `setupTrigger()` を実装する（10分ごと）
    - `testSync()` を実装する（動作確認用）
    - `syncSingleWorkTask(propertyNumber)` を実装する（デバッグ用）
    - _Bug_Condition: isBugCondition(input) — 物件番号が存在する業務依頼行_
    - _Expected_Behavior: work_tasks テーブルへの upsert が成功し、全フィールドが反映される_
    - _Preservation: 既存の WorkTaskSyncService および他フェーズは変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 EnhancedAutoSyncService の Phase 4 コメントを更新する（オプション）
    - `backend/src/services/EnhancedAutoSyncService.ts` の Phase 4 コメントを更新する
    - 「handled elsewhere」を「GASスクリプト（gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs）で処理」に変更する
    - コードロジックは変更しない（コメントのみ）
    - _Requirements: 2.1_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 業務依頼GAS同期の実行
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - GASスクリプトを手動実行（`testSync()`）し、DBの `work_tasks` テーブルを確認する
    - AA9195 の `site_registration_deadline` がスプレッドシートの値と一致することを確認する
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES（GASスクリプトが正しく upsert している）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存同期APIの動作維持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - `POST /api/work-tasks/sync` が引き続き正常に動作することを確認する
    - `POST /api/work-tasks/sync/AA9195` が引き続き正常に動作することを確認する
    - `runFullSync()` で他フェーズが引き続き正常に動作することを確認する
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS（既存APIに影響なし）
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - GASスクリプトを GAS エディタに貼り付け、`setupTrigger()` を手動実行してトリガーを設定する
  - `testSync()` を手動実行して動作確認する
  - DBの `work_tasks` テーブルでデータが正しく反映されていることを確認する
  - 10分後に自動トリガーが実行されることを確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
