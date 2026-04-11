# 実装計画: 業務依頼リスト「サイト登録」タブへの表示追加機能

## 概要

Supabaseテーブル作成 → GAS同期関数追加 → フロントエンドUI変更の順で実装する。
各ステップは前のステップに依存するため、順番通りに実施すること。

## タスク

- [x] 1. Supabase `cw_counts` テーブルの作成
  - `backend/migrations/` に `113_create_cw_counts_table.sql` を新規作成する
  - 設計書のDDLに従い `cw_counts` テーブルを作成する（`id`, `item_name`, `current_total`, `synced_at`, `updated_at`）
  - `item_name` に UNIQUE 制約を付与する
  - RLSポリシーを設定する（フロントエンドからの SELECT を許可）
  - _Requirements: 4.1_

- [x] 2. GAS `syncCwCounts()` 関数の追加
  - [x] 2.1 `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` に `syncCwCounts()` 関数を追加する
    - CWカウントシート（ID: `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g`、シート名「CWカウント」）を開く処理を実装する
    - `getCwCountValue(sheet, itemName)` ヘルパー関数を実装する（「項目」列と「現在計」列を検索）
    - 「間取図（300円）」と「サイト登録」の2行を取得し、Supabase `cw_counts` テーブルへ upsert する
    - エラー時はログに記録してスキップする（業務依頼同期は継続）
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 既存の定期実行トリガー関数に `syncCwCounts()` の呼び出しを追加する
    - 既存の10分ごとトリガー関数（`syncGyomuWorkTasks()` 等）の末尾に `syncCwCounts()` の呼び出しを追加する
    - _Requirements: 4.1_

- [ ] 3. チェックポイント - GAS動作確認
  - `syncCwCounts()` を手動実行し、`cw_counts` テーブルに「間取図（300円）」と「サイト登録」の行が挿入されることを確認する。疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: CWカウント取得フックの実装
  - [x] 4.1 `frontend/frontend/src/components/WorkTaskDetailModal.tsx` に `useCwCounts` フックを追加する
    - Supabase JSクライアントを使用して `cw_counts` テーブルから `item_name` と `current_total` を取得する
    - `CwCountData` 型（`floorPlan300: string | null`, `siteRegistration: string | null`）を定義する
    - エラー時・データなし時はフォールバック値 `'-'` を返す
    - _Requirements: 2.3, 3.3, 4.3_

  - [ ]* 4.2 `useCwCounts` のプロパティテストを書く
    - **Property 1: CWカウント表示フォーマットの一貫性**
    - **Validates: Requirements 2.2**
    - fast-check を使用し、任意の文字列値に対して `間取図300円（CW)計⇒ {値}` 形式で返ることを検証する

  - [ ]* 4.3 `useCwCounts` のプロパティテストを書く
    - **Property 2: サイト登録CWカウント表示フォーマットの一貫性**
    - **Validates: Requirements 3.2**
    - fast-check を使用し、任意の文字列値に対して `サイト登録（CW)計⇒ {値}` 形式で返ることを検証する

- [x] 5. フロントエンド: `ReadOnlyDisplayField` コンポーネントの追加
  - `WorkTaskDetailModal.tsx` 内に `ReadOnlyDisplayField` コンポーネントを追加する
  - `label`, `value`, `labelColor` (`'error'` | `'text.secondary'`) の props を受け取る
  - MUI の `Grid` + `Typography` を使用して既存フィールドと同じレイアウトで表示する
  - _Requirements: 1.2, 1.3, 2.5, 3.5_

  - [ ]* 5.1 `ReadOnlyDisplayField` のプロパティテストを書く
    - **Property 3: email_distribution 値のパススルー**
    - **Validates: Requirements 1.4, 1.5**
    - fast-check を使用し、null・空文字・任意の文字列でエラーが発生しないことを検証する

- [x] 6. フロントエンド: 「メール配信」フィールドの追加（要件1）
  - `SiteRegistrationSection` の「確認後処理」セクションで「公開予定日」フィールドの直下に `ReadOnlyDisplayField` を追加する
  - ラベル「メール配信」、`labelColor="error"`（赤字）、値は `task.email_distribution` を渡す
  - `email_distribution` が null/空の場合は空表示（エラーなし）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7. フロントエンド: 「間取図300円（CW）計」フィールドの追加（要件2）
  - `SiteRegistrationSection` の「確認関係」セクションで「間取図完了日」フィールドの直上に `ReadOnlyDisplayField` を追加する
  - ラベルなし（または空）、値は `floorPlan300 ? \`間取図300円（CW)計⇒ ${floorPlan300}\` : '-'` を渡す
  - `useCwCounts` フックから取得した値を使用する
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 8. フロントエンド: 「サイト登録（CW）計」フィールドの追加（要件3）
  - `SiteRegistrationSection` の「★サイト登録確認」セクションで「サイト登録確認OK送信」フィールドの直下に `ReadOnlyDisplayField` を追加する
  - ラベルなし（または空）、値は `siteRegistration ? \`サイト登録（CW)計⇒ ${siteRegistration}\` : '-'` を渡す
  - `useCwCounts` フックから取得した値を使用する
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 9. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- タスク3のGAS動作確認後にフロントエンド実装（タスク4〜8）を進めること
- CWカウントデータはSupabaseから直接取得するため、バックエンドAPIへの変更は不要
