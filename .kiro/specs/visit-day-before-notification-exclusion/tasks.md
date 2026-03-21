# 実装計画: visit-day-before-notification-exclusion

## 概要

`isVisitDayBefore` 関数に `visitReminderAssignee` チェックを追加し、通知担当が既に割り当て済みの売主を「訪問日前日」カテゴリーから除外する。変更は `sellerStatusFilters.ts` の3行追加のみ。

## タスク

- [x] 1. `isVisitDayBefore` 関数に `visitReminderAssignee` チェックを追加
  - `frontend/frontend/src/utils/sellerStatusFilters.ts` の `isVisitDayBefore` 関数を修正
  - `visitDate` チェックの後、`isVisitDayBeforeUtil` 呼び出しの前に以下を追加:
    ```typescript
    // visitReminderAssigneeに値がある場合は除外（通知担当が既に割り当て済み）
    const visitReminderAssignee = seller.visitReminderAssignee || seller.visit_reminder_assignee || '';
    if (visitReminderAssignee.trim() !== '') {
      return false;
    }
    ```
  - camelCase (`visitReminderAssignee`) と snake_case (`visit_reminder_assignee`) の両形式を参照
  - `undefined` / `null` は `|| ''` でフォールバック
  - _Requirements: 1.1, 1.3, 1.4, 3.1, 3.2_

- [x] 2. テストファイルを作成してユニットテストを実装
  - [x] 2.1 テストファイル `frontend/frontend/src/utils/sellerStatusFilters.test.ts` を新規作成
    - `isVisitDayBefore` のテストスイートを作成
    - `isVisitDayBeforeUtil` と `getTodayJSTString` のモックを設定
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 `visitReminderAssignee` に値がある場合の除外テスト（ユニットテスト）
    - `visitReminderAssignee` に値がある売主 → `false` を返すことを確認
    - `visit_reminder_assignee` に値がある売主 → `false` を返すことを確認
    - `hasVisitAssignee` が `false` の売主（`visitReminderAssignee` に値があっても）→ `false`（Requirements 1.3）
    - `visitDate` が未設定の売主（`visitReminderAssignee` に値があっても）→ `false`（Requirements 2.4）
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 2.3 `visitReminderAssignee` が空の場合の既存ロジック維持テスト（ユニットテスト）
    - `visitReminderAssignee` が空文字列 → 既存ロジックに委ねる
    - `visitReminderAssignee` が `undefined` → 既存ロジックに委ねる
    - `visitReminderAssignee` が `null` → 既存ロジックに委ねる
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 3. プロパティベーステストを実装（fast-check）
  - [ ]* 3.1 Property 1: `visitReminderAssignee` に値がある売主は除外される
    - **Property 1: visitReminderAssignee に値がある売主は除外される**
    - **Validates: Requirements 1.1, 1.4**
    - `visitReminderAssignee` に任意の非空文字列を持つ売主で `isVisitDayBefore` が常に `false` を返すことを検証
    - `numRuns: 100`

  - [ ]* 3.2 Property 2: `visitReminderAssignee` が空の場合は既存ロジックが適用される
    - **Property 2: visitReminderAssignee が空の場合は既存ロジックが適用される**
    - **Validates: Requirements 1.2, 2.1, 2.2**
    - `visitReminderAssignee` が空の売主で `isVisitDayBefore` の結果が `isVisitDayBeforeUtil` の結果と一致することを検証
    - 木曜訪問（2日前）・木曜以外（1日前）のケースを含む
    - `numRuns: 100`

  - [ ]* 3.3 Property 3: camelCase / snake_case の両形式で正しく動作する
    - **Property 3: camelCase / snake_case の両形式で正しく動作する**
    - **Validates: Requirements 3.1, 3.2**
    - `visitReminderAssignee`（camelCase）または `visit_reminder_assignee`（snake_case）のいずれかに非空文字列がある場合、`false` を返すことを検証
    - 両フィールドが `undefined` の場合は除外しないことを検証
    - `numRuns: 100`

- [x] 4. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- プロパティベーステストには `fast-check` を使用（`frontend/frontend` に既にインストール済みか確認すること）
- テスト実行コマンド: `cd frontend/frontend && npx vitest run src/utils/sellerStatusFilters.test.ts`
