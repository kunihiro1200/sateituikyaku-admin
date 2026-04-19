# 実装計画：業務リスト詳細画面 締日超過警告ポップアップ

## 概要

`WorkTaskDetailModal.tsx` に締日超過チェックロジックと警告ポップアップを追加する。
純粋関数 `isDeadlineExceeded` をモジュールレベルに定義し、`DeadlineWarningDialog` コンポーネントと `warningDialog` ステートを追加する。
既存の `handleFieldChange` を拡張して、対象フィールド変更時にリアルタイムで締日超過チェックを実行する。

## タスク

- [x] 1. `isDeadlineExceeded` 純粋関数の実装
  - `WorkTaskDetailModal.tsx` のモジュールレベル（コンポーネント関数の外）に `isDeadlineExceeded(dueDate, deadline)` を定義する
  - `dueDate` の日付部分（`T` 以前の `YYYY-MM-DD`）を抽出して `deadline` と文字列比較する
  - `dueDate` または `deadline` が空・null・undefined の場合は `false` を返す
  - `Date` オブジェクトへのパース失敗（`isNaN`）の場合も `false` を返す
  - 例外をスローしない防御的実装とする
  - _要件: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 `isDeadlineExceeded` のプロパティテストを作成する
    - **プロパティ1: 締日超過判定の正確性**
    - 任意の有効な `dueDate`（datetime-local形式）と `deadline`（date形式）のペアに対して、日付部分が `deadline` より後のときのみ `true` を返すことを検証する
    - fast-check を使用し、`numRuns: 100` で実行する
    - **検証: 要件 1.1, 1.2, 2.1, 2.2**

  - [ ]* 1.2 `isDeadlineExceeded` の無効入力プロパティテストを作成する
    - **プロパティ2: 無効入力に対する安全性**
    - 任意の無効な入力（空文字・null・undefined・パース不能な文字列）が渡された場合に常に `false` を返すことを検証する
    - fast-check を使用し、`numRuns: 100` で実行する
    - **検証: 要件 1.3, 1.4, 2.3, 2.4**

  - [ ]* 1.3 `isDeadlineExceeded` の具体例ユニットテストを作成する
    - `dueDate = "2025-08-10T12:00"`, `deadline = "2025-08-05"` → `true`
    - `dueDate = "2025-08-05T12:00"`, `deadline = "2025-08-05"` → `false`（同日）
    - `dueDate = "2025-08-04T12:00"`, `deadline = "2025-08-05"` → `false`（以前）
    - `dueDate = ""`, `deadline = "2025-08-05"` → `false`
    - `dueDate = null`, `deadline = "2025-08-05"` → `false`
    - `dueDate = "invalid"`, `deadline = "2025-08-05"` → `false`
    - _要件: 1.1, 1.2, 1.3, 1.4_

- [x] 2. `DeadlineWarningDialog` コンポーネントの実装
  - `WorkTaskDetailModal.tsx` 内に `DeadlineWarningDialog` コンポーネントを追加する
  - props: `open: boolean`, `fieldLabel: string`, `onClose: () => void`
  - MUI `Dialog` を使用する（既存インポート済みのため追加インポート不要）
  - タイトル「締日超過の警告」を表示する
  - メッセージ「サイト登録締日を過ぎています　担当に確認しましたか？」を表示する
  - 確認ボタンクリックで `onClose` を呼び出す
  - `open=false` のとき Dialog が表示されないこと
  - _要件: 1.5, 2.5, 3.4_

  - [ ]* 2.1 `DeadlineWarningDialog` のコンポーネントテストを作成する
    - 警告メッセージが正しく表示されることを検証する
    - 確認ボタンクリックで `onClose` が呼ばれることを検証する
    - `open=false` のとき Dialog が表示されないことを検証する
    - _要件: 1.5, 2.5, 3.4_

- [x] 3. `WorkTaskDetailModal` への `warningDialog` ステートと警告チェックロジックの追加
  - `warningDialog` ステート（`{ open: boolean, fieldLabel: string }`）を追加する
  - 既存の `handleFieldChange` を拡張し、`site_registration_due_date` と `floor_plan_due_date` の変更時に `isDeadlineExceeded` を呼び出す
  - `deadline` の取得は `editedData` を優先し、未編集の場合は `data` から取得する
  - 超過が検出された場合は `setWarningDialog({ open: true, fieldLabel: ... })` を呼び出す
  - `DeadlineWarningDialog` の `onClose` で `setWarningDialog({ open: false, fieldLabel: '' })` を呼び出す
  - `editedData` の値は変更しない（入力値を保持する）
  - _要件: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1_

  - [ ]* 3.1 `WorkTaskDetailModal` の統合テストを作成する
    - `site_registration_due_date` フィールド変更時に締日超過チェックが実行されることを検証する
    - `floor_plan_due_date` フィールド変更時に締日超過チェックが実行されることを検証する
    - 警告ポップアップを閉じた後も `editedData` の値が保持されることを検証する（プロパティ3）
    - `site_registration_deadline` が未設定の場合、警告が表示されないことを検証する
    - _要件: 3.1, 3.2, 3.3, 3.5_

- [x] 4. `DeadlineWarningDialog` を JSX に組み込む
  - `WorkTaskDetailModal` の JSX 内に `<DeadlineWarningDialog>` を追加する
  - `open={warningDialog.open}`, `fieldLabel={warningDialog.fieldLabel}`, `onClose={...}` を渡す
  - _要件: 3.3, 3.4, 4.2_

- [x] 5. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 備考

- `*` が付いたタスクはオプションであり、MVP では省略可能
- 各タスクは要件との対応が明示されている
- `isDeadlineExceeded` はモジュールレベルの純粋関数として定義するため、コンポーネントから独立してテスト可能
- 日付比較は日付部分のみで行い、時刻は無視する（同日は警告しない）
- 警告ポップアップは表示のみ行い、入力値を変更しない
