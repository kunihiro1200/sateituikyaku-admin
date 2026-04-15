# 実装計画：除外日設定時の査定方法自動選択

## 概要

CallModePage（`/sellers/:id/call`）において、「除外日にすること」フィールドに値が選択されたとき、「査定方法」フィールドが空欄であれば自動的に「不要」を設定する機能を実装する。

変更対象はフロントエンドのみ（`frontend/frontend/src/pages/CallModePage.tsx`）。

## タスク

- [x] 1. 純粋関数 `applyAutoValuationMethod` の実装とテスト
  - [x] 1.1 `applyAutoValuationMethod` 関数を `CallModePage.tsx` に追加する
    - 設計書のテスト対象純粋関数セクションに記載された関数シグネチャを実装する
    - `newExclusionAction` が空文字、または `currentValuationMethod` が設定済みの場合は `currentValuationMethod` をそのまま返す
    - それ以外（除外日アクションが選択され、査定方法が空欄）の場合は `'不要'` を返す
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 Property 1 のプロパティテストを書く
    - **Property 1: 査定方法が空欄の場合、除外日アクション選択で「不要」が自動設定される**
    - **Validates: Requirements 1.1, 1.5**
    - fast-check を使用し、`fc.constantFrom('除外日に不通であれば除外', '除外日になにもせず除外')` で全選択肢を網羅する
    - `applyAutoValuationMethod(option, '')` の結果が `'不要'` であることを検証する

  - [ ]* 1.3 Property 2 のプロパティテストを書く
    - **Property 2: 査定方法に既存値がある場合、除外日アクション選択で値が変更されない**
    - **Validates: Requirements 1.2**
    - `fc.constantFrom` で全除外日アクション選択肢と全査定方法値を組み合わせる
    - `applyAutoValuationMethod(option, existingMethod)` の結果が `existingMethod` と等しいことを検証する

  - [ ]* 1.4 Property 3 のプロパティテストを書く
    - **Property 3: 除外日アクション解除時、査定方法は変更されない**
    - **Validates: Requirements 1.3**
    - `fc.constantFrom` で全査定方法値（空欄含む）を生成する
    - `applyAutoValuationMethod('', currentMethod)` の結果が `currentMethod` と等しいことを検証する

- [x] 2. CallModePage の onClick ハンドラーに自動設定ロジックを組み込む
  - [x] 2.1 「除外日にすること」ボタンの `onClick` ハンドラーを修正する
    - `frontend/frontend/src/pages/CallModePage.tsx` の行 7382〜7393 付近の `onClick` ハンドラーを対象とする
    - `value` が設定された場合（`if (value)` ブロック内）に `applyAutoValuationMethod` を呼び出す
    - 戻り値が現在の `editedValuationMethod` と異なる場合（つまり空欄から「不要」に変わる場合）のみ `handleValuationMethodChange('不要')` を呼び出す
    - 既存の次電日自動設定ロジックは変更しない
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 ユニットテストを書く
    - 査定方法が空欄のとき `handleValuationMethodChange('不要')` が呼ばれることを確認する（要件 1.1, 1.4）
    - 査定方法が設定済みのとき `handleValuationMethodChange` が呼ばれないことを確認する（要件 1.2）
    - 除外日アクション解除時（`value = ''`）に `handleValuationMethodChange` が呼ばれないことを確認する（要件 1.3）
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応が明確になるよう要件番号を記載
- プロパティテストは fast-check（既存プロジェクトで使用中）を使用する
- バックエンドへの変更は不要（既存の `PUT /api/sellers/:id` エンドポイントをそのまま利用）
