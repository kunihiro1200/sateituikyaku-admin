# 実装計画：業務詳細画面バリデーション警告機能

## 概要

`WorkTaskDetailModal.tsx` に、フィールド整合性チェックとバリデーション警告ダイアログを追加する。
バリデーションロジックを純粋関数として切り出し、既存の `RowAddWarningDialog` パターンを踏襲して `ValidationWarningDialog` コンポーネントを実装する。

## タスク

- [x] 1. バリデーション純粋関数の実装
  - [x] 1.1 `isEmpty` ヘルパー関数と `getValue` 関数を実装する
    - `''`、`null`、`undefined` を空欄と判定する `isEmpty` 関数を定義する
    - `editedData` 優先で最終値を返す `getValue` 関数を定義する
    - `WorkTaskDetailModal.tsx` 内に配置する
    - _Requirements: 1.1, 2.1_

  - [ ]* 1.2 Property 4 のプロパティテストを書く（`getValue` の優先順位）
    - **Property 4: 最終値計算の優先順位**
    - **Validates: Requirements 1.1, 2.1**

  - [x] 1.3 `checkSiteRegistrationWarning` 関数を実装する
    - `site_registration_confirmed` と `site_registration_ok_sent` のXOR条件を評価する
    - `hasWarning: boolean` と `emptyFields: string[]` を返す
    - フィールド表示名マッピング（`SITE_REGISTRATION_FIELD_LABELS`）を定義する
    - _Requirements: 1.2, 1.9, 1.10_

  - [ ]* 1.4 Property 1 のプロパティテストを書く（サイト登録確認バリデーション）
    - **Property 1: サイト登録確認バリデーションの正確性**
    - **Validates: Requirements 1.2, 1.9, 1.10**

  - [x] 1.5 `checkFloorPlanWarning` 関数を実装する
    - 4フィールドのうち一部入力・一部空欄の場合に警告を返す
    - `hasWarning: boolean` と `emptyFields: string[]` を返す
    - フィールド表示名マッピング（`FLOOR_PLAN_FIELD_LABELS`）を定義する
    - _Requirements: 2.2, 2.9, 2.10_

  - [ ]* 1.6 Property 2 のプロパティテストを書く（間取図グループバリデーション）
    - **Property 2: 間取図グループバリデーションの正確性**
    - **Validates: Requirements 2.2, 2.9, 2.10**

  - [ ]* 1.7 Property 3 のプロパティテストを書く（空欄フィールド名の完全性）
    - **Property 3: 空欄フィールド名の完全性**
    - **Validates: Requirements 1.4, 2.4**

- [x] 2. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. `ValidationWarningDialog` コンポーネントの実装
  - [x] 3.1 `ValidationWarningDialog` コンポーネントを実装する
    - `ValidationWarningDialogProps` インターフェースを定義する（`open`, `title`, `emptyFields`, `onConfirm`, `onCancel`）
    - MUI `Dialog` を使用して既存の `RowAddWarningDialog` パターンを踏襲する
    - タイトル部分に `WarningAmber` アイコンをオレンジ系（`warning` カラー）で表示する
    - 空欄フィールド名の一覧を表示する
    - 「このまま保存する」ボタン（`primary` カラー）を実装する
    - 「キャンセル」ボタン（`error` カラー）を実装する
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 2.3, 2.4, 2.5, 2.7, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.2 `ValidationWarningDialog` のユニットテストを書く
    - 警告メッセージ・アイコン・ボタンのレンダリングを確認する
    - 「このまま保存する」押下時に `onConfirm` が呼ばれることを確認する
    - 「キャンセル」押下時に `onCancel` が呼ばれることを確認する
    - _Requirements: 1.3, 1.5, 1.7, 2.3, 2.5, 2.7, 4.1, 4.2, 4.3, 4.4_

- [x] 4. `handleSave` へのバリデーション組み込みと状態管理
  - [x] 4.1 `validationWarningDialog` 状態を追加する
    - `open`, `title`, `emptyFields`, `onConfirmAction: 'site' | 'floor' | null` を持つ状態を定義する
    - _Requirements: 1.2, 2.2, 3.1_

  - [x] 4.2 `handleSave` にサイト登録確認グループのチェックを追加する
    - 既存の `RowAddWarningDialog` チェックの後に要件1チェックを挿入する
    - 警告あり時は `validationWarningDialog` を `open: true, onConfirmAction: 'site'` でセットして `return` する
    - _Requirements: 1.2, 1.9, 1.10, 3.1_

  - [x] 4.3 `handleSave` に間取図グループのチェックを追加する
    - 要件1チェックの後に要件2チェックを挿入する
    - 警告あり時は `validationWarningDialog` を `open: true, onConfirmAction: 'floor'` でセットして `return` する
    - _Requirements: 2.2, 2.9, 2.10, 3.1_

  - [x] 4.4 `handleValidationWarningConfirm` ハンドラを実装する
    - `onConfirmAction === 'site'` の場合は要件2チェックを実行し、警告があれば `floor` ダイアログを表示する
    - `onConfirmAction === 'floor'` または要件2チェックが問題なしの場合は `executeSave()` を呼ぶ
    - _Requirements: 1.6, 2.6, 3.2_

  - [x] 4.5 `handleValidationWarningCancel` ハンドラを実装する
    - ダイアログを閉じ、保存処理を実行しない
    - _Requirements: 1.8, 2.8, 3.3_

  - [ ]* 4.6 順序制御のユニットテストを書く
    - 要件1警告後に「このまま保存する」を押すと要件2チェックが実行されることを確認する
    - 要件1「キャンセル」後に要件2チェックが実行されないことを確認する
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. `ValidationWarningDialog` を JSX に組み込む
  - [x] 5.1 `WorkTaskDetailModal` の JSX に `ValidationWarningDialog` を追加する
    - `validationWarningDialog` の状態を props として渡す
    - `onConfirm` に `handleValidationWarningConfirm`、`onCancel` に `handleValidationWarningCancel` を渡す
    - _Requirements: 1.2, 1.3, 2.2, 2.3_

- [x] 6. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- プロパティテストは `fast-check` を使用し、最小100イテレーション実行する
- 各タスクは対応する要件番号を参照しているため、トレーサビリティが確保されている
- チェックポイントでインクリメンタルな動作確認を行う
