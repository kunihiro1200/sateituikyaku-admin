# 実装計画: 業務依頼リスト「サイト登録」タブ拡張機能

## 概要

DBマイグレーション → 設定ファイル更新 → フロントエンドUI変更の順で実装する。
各ステップは前のステップに依存するため、順番通りに実施すること。

## タスク

- [x] 1. DBマイグレーションの作成
  - `backend/migrations/112_change_site_registration_due_date_to_timestamptz.sql` を新規作成する
  - `ALTER TABLE work_tasks ALTER COLUMN site_registration_due_date TYPE TIMESTAMPTZ USING site_registration_due_date::TIMESTAMPTZ;` を記述する
  - `COMMENT ON COLUMN` でカラムコメントを追加する
  - _Requirements: 1.5_

- [x] 2. work-task-column-mapping.json の更新
  - [x] 2.1 バックエンド側の `typeConversions` を更新する
    - `backend/src/config/work-task-column-mapping.json` を開く
    - `site_registration_due_date` の値を `"date"` → `"datetime"` に変更する
    - `floor_plan_due_date` の値が `"datetime"` であることを確認し、異なる場合は修正する
    - _Requirements: 1.6, 2.5_

  - [x] 2.2 フロントエンド側の `typeConversions` を更新する
    - `frontend/frontend/src/backend/config/work-task-column-mapping.json` を開く
    - `site_registration_due_date` の値を `"date"` → `"datetime"` に変更する
    - `floor_plan_due_date` の値が `"datetime"` であることを確認し、異なる場合は修正する
    - `site_registration_ok_comment` と `site_registration_ok_sent` のマッピングが存在することを確認する
    - _Requirements: 1.6, 2.5, 5.1, 5.2_

- [x] 3. WorkTaskDetailModal.tsx の更新
  - [x] 3.1 `formatDateTimeForInput` 関数を追加する
    - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を開く
    - 既存の `formatDateForInput` 関数の近くに `formatDateTimeForInput` 関数を追加する
    - TIMESTAMPTZ / ISO 8601 文字列を `YYYY-MM-DDTHH:mm` 形式に変換する実装を行う
    - null / undefined / 空文字の場合は空文字を返す
    - `new Date(dateStr)` が無効な場合（`isNaN`）は空文字を返す
    - _Requirements: 1.3, 2.3_

  - [ ]* 3.2 `formatDateTimeForInput` のプロパティテストを書く
    - **Property 1: datetime-local 変換の正規化**
    - **Validates: Requirements 1.3, 2.3**
    - fast-check を使用し、有効な日付文字列に対して `YYYY-MM-DDTHH:mm` 形式または空文字を返すことを検証する

  - [ ]* 3.3 `formatDateTimeForInput` のプロパティテストを書く
    - **Property 2: null/空文字の安全な処理**
    - **Validates: Requirements 1.3, 2.3**
    - null / undefined / 空文字の入力に対して例外をスローせず空文字を返すことを検証する

  - [x] 3.4 `getDefaultDueDatetime` 関数を追加する
    - 現在の `getDefaultDueDate`（DATE用）の近くに `getDefaultDueDatetime` 関数を追加する
    - 今日が火曜日（dayOfWeek === 2）なら +3日、それ以外は +2日の `YYYY-MM-DDTHH:mm` 形式（時刻は 12:00）を返す
    - _Requirements: 1.4_

  - [x] 3.5 `EditableField` コンポーネントに `datetime-local` 対応を追加する
    - `type` の型定義に `'datetime-local'` を追加する
    - `type === 'datetime-local'` の場合に `formatDateTimeForInput` を使って `TextField type="datetime-local"` を描画する分岐を追加する
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 `SiteRegistrationSection` の `site_registration_due_date` フィールドを変更する
    - `type="date"` → `type="datetime-local"` に変更する
    - `formatDateForInput` → `formatDateTimeForInput` に変更する
    - デフォルト値を `getDefaultDueDate()` → `getDefaultDueDatetime()` に変更する
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 3.7 `SiteRegistrationSection` の `floor_plan_due_date` フィールドを変更する
    - `EditableField` の `type` を `"date"` → `"datetime-local"` に変更する
    - _Requirements: 2.1, 2.2_

  - [x] 3.8 「サイト登録確認OKコメント」と「サイト登録確認OK送信」フィールドを追加する
    - `SiteRegistrationSection` 内の「メール配信v」（`email_distribution`）フィールドの直下に追加する
    - `<EditableField label="サイト登録確認OKコメント" field="site_registration_ok_comment" type="text" />` を追加する
    - `<EditableYesNo label="サイト登録確認OK送信" field="site_registration_ok_sent" />` を追加する（`floor_plan_ok_sent` と同様の実装）
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- マイグレーション（タスク1）は本番DBに適用するまでフロントエンドの動作確認はローカルで行うこと
- `formatDateTimeForInput` はブラウザのローカルタイムゾーンで表示されるため、JST環境では UTC+9 で表示される（既存の `floor_plan_due_date` と同じ挙動）
