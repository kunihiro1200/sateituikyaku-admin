# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 「過去の追客ログ」セクションへの通話記録表示
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: 通話記録を含む売主データを対象に、`FollowUpLogHistoryTable` が通話記録を表示することを確認する
  - `FollowUpLogHistoryTable` に渡されるデータに通話記録（電話架電に関するエントリー）が含まれることを確認
  - 修正後の期待動作: `FollowUpLogHistoryTable` は通話記録を除外し、Email/SMS履歴のみを表示する
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS（通話記録が表示されることを確認 → バグの存在を証明）
  - Document counterexamples found（例: 「過去の追客ログ」に「2026/03/16 12:14 - 担当: Y」のような通話記録が表示される）
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Email/SMS履歴の表示と `CallLogDisplay` の動作保持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: 未修正コードで Email/SMS 送信履歴を持つ売主の `FollowUpLogHistoryTable` を表示し、Email/SMS 履歴が正しく表示されることを確認
  - Observe: 未修正コードで `CallLogDisplay` が通話履歴（`phone_call` タイプ）のみを正しく表示することを確認
  - Write property-based test: 通話記録でない全ての入力（Email/SMS履歴）に対して、`FollowUpLogHistoryTable` が正しく表示することを確認（Preservation Requirements in design）
  - Write property-based test: `CallLogDisplay` の動作が変わらないことを確認
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS（ベースライン動作を確認）
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 3. Fix: 「過去の追客ログ」セクションから通話記録を除外する

  - [x] 3.1 スプレッドシートのカラム構造を調査する
    - `backend/src/config/follow-up-log-history-column-mapping.json` を確認し、アクティビティタイプを区別するカラムが存在するかを確認
    - `frontend/frontend/src/components/FollowUpLogHistoryTable.tsx` のデータ構造（`FollowUpLogHistoryEntry` 型）を確認
    - `backend/src/services/FollowUpLogHistoryService.ts` のデータ取得ロジックを確認
    - 調査結果に基づいて実装方針（ケース1またはケース2）を決定する
    - _Bug_Condition: isBugCondition(context) where context.section = 'FollowUpLogHistoryTable' AND context.displayedData に通話記録が含まれる_
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 フィルタリングロジックを実装する
    - **ケース1（スプレッドシートにタイプカラムが存在する場合）**:
      - `FollowUpLogHistoryEntry` 型に `activityType` フィールドを追加（`backend/src/types/followUpLogHistory.ts`）
      - `FollowUpLogHistoryService.mapRowToEntry()` でタイプカラムをマッピング
      - `FollowUpLogHistoryService.getHistoricalLogs()` で Email/SMS タイプのみをフィルタリング
    - **ケース2（スプレッドシートにタイプカラムが存在しない場合 - 最も可能性が高い）**:
      - `FollowUpLogHistoryTable` コンポーネントにフィルタリング props（例: `excludeTypes`）を追加
      - または `CallModePage.tsx` で `FollowUpLogHistoryTable` の代わりに Email/SMS のみを表示するセクションを使用
      - `CallModePage.tsx` の `FollowUpLogHistoryTable` 使用箇所（行 2903-2906 付近）を修正
    - Email/SMS 履歴が存在しない場合は「この売主の履歴データはありません」と表示されることを確認
    - `CallLogDisplay` の通話履歴表示ロジックは変更しない
    - _Expected_Behavior: FollowUpLogHistoryTable は通話記録を除外し、Email/SMS 履歴のみを表示する_
    - _Preservation: CallLogDisplay の phone_call タイプ表示、Email/SMS 履歴の正常表示、キャッシュ・更新機能は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 「過去の追客ログ」セクションへの通話記録表示
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES（通話記録が除外されることを確認 → バグ修正を証明）
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Email/SMS履歴の表示と `CallLogDisplay` の動作保持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS（リグレッションなしを確認）
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - 全テストが通過することを確認する
  - 「過去の追客ログ」セクションに通話記録が表示されないことをブラウザで確認する
  - 「売主追客ログ」セクション（`CallLogDisplay`）が引き続き通話履歴を正しく表示することを確認する
  - Email/SMS 送信履歴が「過去の追客ログ」セクションに正しく表示されることを確認する
  - 疑問が生じた場合はユーザーに確認する
