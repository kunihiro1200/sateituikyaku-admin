# 実装計画：買主詳細画面 問合せ内容フィールド 保存ボタン化

## 概要

`BuyerDetailPage.tsx` の「問合せ内容」セクションにある10個の対象フィールドについて、保存タイミングを自動保存から保存ボタン押下時のまとめ保存に変更する。既存の `handleSectionSave`・`handleFieldChange`・`SectionSaveButton` を活用し、対象フィールドの変更ハンドラーから `handleInlineFieldSave` の呼び出しを削除することで実現する。

## タスク

- [x] 1. 対象フィールド定数の定義と保存フロー分岐の実装
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の先頭付近（`BUYER_FIELD_SECTIONS` 定義の前）に `SAVE_BUTTON_FIELDS` 定数を追加する
  - ```typescript
    const SAVE_BUTTON_FIELDS = new Set([
      'inquiry_email_phone',
      'distribution_type',
      'pinrich',
      'broker_survey',
      'three_calls_confirmed',
      'initial_assignee',
      'owned_home_hearing_inquiry',
      'owned_home_hearing_result',
      'valuation_required',
      'broker_inquiry',
    ]);
    ```
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. `buttonSelect` / `dropdown` フィールドの保存フロー変更
  - [x] 2.1 `buttonSelect` フィールド（`broker_survey`・`distribution_type`・`three_calls_confirmed`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - `SAVE_BUTTON_FIELDS` に含まれるフィールドかどうかを判定して分岐させる
    - _Requirements: 1.1, 1.2_
  - [ ]* 2.2 Property 1 のプロパティテストを作成する
    - **Property 1: 対象フィールド変更時はDB保存が呼ばれない**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 2.3 `dropdown` フィールド（`inquiry_email_phone`・`pinrich`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_
  - [ ]* 2.4 Property 4 のプロパティテストを作成する
    - **Property 4: 対象外フィールドは変更と同時に保存される**
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. カスタムフィールドの保存フロー変更
  - [x] 3.1 `initial_assignee`（イニシャル選択）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 `staffSelect` フィールド（`owned_home_hearing_inquiry`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_
  - [x] 3.3 `homeHearingResult` フィールド（`owned_home_hearing_result`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_
  - [x] 3.4 `valuationRequired` フィールド（`valuation_required`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_
  - [x] 3.5 `boxSelect` フィールド（`broker_inquiry`）の変更ハンドラーを修正する
    - `handleInlineFieldSave` の呼び出しを削除し、`handleFieldChange` のみを残す
    - _Requirements: 1.1, 1.2_

- [x] 4. チェックポイント - 対象フィールドの変更ハンドラー修正を確認する
  - 全10フィールドの変更ハンドラーから `handleInlineFieldSave` が削除されていることを確認する
  - 対象外フィールドの変更ハンドラーが変更されていないことを確認する
  - `getDiagnostics` でコンパイルエラーがないことを確認する
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 必須フィールドバリデーションの動作確認と修正
  - [x] 5.1 対象フィールドの変更時に `missingRequiredFields` が正しく更新されることを確認する
    - `handleFieldChange` 呼び出し後に `setMissingRequiredFields` が実行されているか確認する
    - 必要に応じて `handleFieldChange` 内または変更ハンドラー内でバリデーションを呼び出す
    - _Requirements: 3.1, 3.2_
  - [ ]* 5.2 Property 5 のプロパティテストを作成する
    - **Property 5: 必須チェックはフィールド変更のたびに実行される**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. 保存ボタン押下時の保存フローと成功・失敗ハンドリングの確認
  - [x] 6.1 `handleSectionSave` が `sectionChangedFields` の全変更フィールドをまとめて保存することを確認する
    - 既存の `handleSectionSave` 実装が要件を満たしているか確認する（変更不要の場合はスキップ）
    - `sync: true` が渡されていることを確認する
    - _Requirements: 1.3, 5.1_
  - [ ]* 6.2 Property 2 のプロパティテストを作成する
    - **Property 2: 保存ボタン押下時に全変更フィールドがまとめて保存される**
    - **Validates: Requirements 1.3, 5.1**
  - [x] 6.3 保存成功後に `sectionDirtyStates` が `false` になり `sectionChangedFields` が空になることを確認する
    - 既存の `handleSectionSave` の成功パスを確認する（変更不要の場合はスキップ）
    - _Requirements: 1.4, 4.1, 4.3_
  - [ ]* 6.4 Property 3 のプロパティテストを作成する
    - **Property 3: 保存成功後にdirtyStateがリセットされる**
    - **Validates: Requirements 1.4, 4.1, 4.3**
  - [x] 6.5 保存失敗時のエラーハンドリングを確認する
    - スナックバーでエラーメッセージが表示されること
    - `sectionDirtyStates` が `true` のまま維持されること
    - _Requirements: 1.5_
  - [ ]* 6.6 保存失敗時のユニットテストを作成する
    - 保存失敗時にスナックバーが表示され `sectionDirtyStates` が `true` のままであることをテスト
    - スプシ同期失敗時（`syncStatus === 'failed'`）に警告スナックバーが表示されることをテスト
    - _Requirements: 1.5, 5.2_

- [x] 7. 最終チェックポイント - 全テストパスと動作確認
  - `getDiagnostics` でコンパイルエラーがないことを確認する
  - 対象フィールドを変更しても保存ボタンを押すまでDBに保存されないことを確認する
  - 保存ボタン押下で全変更フィールドがまとめて保存されることを確認する
  - 対象外フィールドが引き続き自動保存されることを確認する
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- タスク `*` 付きはオプションであり、MVPとして省略可能
- 各タスクは `SAVE_BUTTON_FIELDS` 定数を参照して対象フィールドを判定する
- 既存の `handleSectionSave`・`handleFieldChange`・`SectionSaveButton` は変更不要
- 新規 state の追加は不要（既存の `sectionDirtyStates`・`sectionChangedFields`・`sectionSavingStates` を利用）
- プロパティテストには fast-check を使用し、最低100回のイテレーションで実行する
