# 実装計画: buyer-vendor-survey-auto-fill

## 概要

`BuyerDetailPage.tsx` の `vendor_survey` フィールドの `onClick` ハンドラーに、`three_calls_confirmed` を `'他'` に自動セットするロジックを追加する。変更対象は1ファイル1箇所のみ。

## タスク

- [x] 1. vendor_survey onClick ハンドラーに自動セットロジックを実装する
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `vendor_survey` フィールド特別処理ブロック（`if (field.key === 'vendor_survey')` 内）を修正する
  - `newValue` が非空の場合に `setBuyer` で `three_calls_confirmed: '他'` をセットする
  - `handleFieldChange(section.title, 'three_calls_confirmed', '他')` を呼び出して `sectionChangedFields` に追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

  - [ ]* 1.1 Property 1 のプロパティテストを作成する
    - **Property 1: vendor_survey非空入力時にthree_calls_confirmedが"他"にセットされる**
    - **Validates: Requirements 1.1, 1.4, 2.1**
    - `applyVendorSurveyAutoFill(vendorSurveyValue, existingThreeCalls)` ヘルパー関数を抽出してテスト対象とする
    - fast-check を使用し、任意の非空文字列・任意の既存値の組み合わせで `three_calls_confirmed === '他'` を検証する

  - [ ]* 1.2 Property 2 のプロパティテストを作成する
    - **Property 2: vendor_survey非空入力時にsectionChangedFieldsにthree_calls_confirmedが含まれる**
    - **Validates: Requirements 1.3, 2.2**
    - `applyVendorSurveyChangedFields(vendorSurveyValue)` ヘルパー関数を抽出してテスト対象とする
    - fast-check を使用し、任意の非空文字列で `changedFields.three_calls_confirmed === '他'` を検証する

  - [ ]* 1.3 単体テストを作成する
    - `vendor_survey` に `'確認済み'` を入力 → `three_calls_confirmed` が `'他'` になること
    - `vendor_survey` をクリア（空文字）→ `three_calls_confirmed` が変化しないこと
    - `three_calls_confirmed` に既存値 `'3回架電OK'` がある状態で `vendor_survey` に値を入力 → `'他'` に上書きされること
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 2. 最終チェックポイント
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` 付きのサブタスクはオプションであり、MVP優先の場合はスキップ可能
- `SAVE_BUTTON_FIELDS` に `three_calls_confirmed` は既に含まれているため、保存ロジックの変更は不要
- バックエンドへの変更は不要
