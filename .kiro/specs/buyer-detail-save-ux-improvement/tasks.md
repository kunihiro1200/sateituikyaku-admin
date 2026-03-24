# 実装計画: 買主詳細画面 保存UX改善

## 概要

セクション別保存ボタン（SectionSaveButton）を導入し、フィールド変更時にボタンをハイライト表示する。
変更フィールドのみをAPIに送信し、保存完了後にDirtyStateをリセットする。

## タスク

- [x] 1. SectionSaveButton コンポーネントを新規作成する
  - `frontend/frontend/src/components/SectionSaveButton.tsx` を作成
  - `isDirty`, `isSaving`, `onSave` の3プロパティを受け取る
  - `isDirty: false` → `variant="outlined"`, `color="inherit"` で通常表示
  - `isDirty: true` → `variant="contained"`, `color="warning"` + pulse アニメーション
  - `isSaving: true` → `CircularProgress` 表示 + `disabled`
  - ⚠️ 日本語を含まないファイルのため `fsWrite` で直接作成可
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2_

  - [ ]* 1.1 SectionSaveButton のユニットテストを作成する
    - `frontend/frontend/src/__tests__/buyer-detail-save-ux-improvement/SectionSaveButton.test.tsx` を作成
    - `isDirty: false` のとき通常スタイルで表示されることをテスト
    - `isDirty: true` のときハイライトスタイルで表示されることをテスト
    - `isSaving: true` のとき disabled かつ CircularProgress が表示されることをテスト
    - _Requirements: 1.2, 1.3, 3.1_

- [x] 2. InlineEditableField に onChange コールバックを追加する
  - `frontend/frontend/src/components/InlineEditableField.tsx` を編集
  - `onChange?: (fieldName: string, newValue: any) => void` プロパティを追加
  - ドロップダウン選択時・テキスト入力時に `onChange` を呼び出す
  - `onSave` とは独立して動作させる（既存の自動保存ロジックは維持）
  - ⚠️ 日本語を含むファイルのため Pythonスクリプトで UTF-8 書き込みすること
  - _Requirements: 4.1, 4.2_

- [x] 3. BuyerDetailPage に DirtyState 管理 state とハンドラーを追加する
  - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を編集
  - 3つの state を追加: `sectionDirtyStates`, `sectionChangedFields`, `sectionSavingStates`
  - `handleFieldChange(sectionTitle, fieldName, newValue)` を実装
    - 元の値（`buyer[fieldName]`）と比較して変更判定
    - 元の値と同じ場合は `sectionChangedFields` からそのフィールドを削除
    - `sectionChangedFields` が空になったら `sectionDirtyStates` を false に設定
  - `handleSectionSave(sectionTitle)` を実装
    - `sectionChangedFields[sectionTitle]` が空なら早期リターン
    - `buyerApi.update(buyer_number!, changedFields, { sync: true })` を呼び出す
    - 成功時: `setBuyer`, DirtyState リセット, スナックバー表示
    - 失敗時: エラースナックバー表示, DirtyState 維持
    - `finally` で `sectionSavingStates` を必ず false に設定
  - ⚠️ 日本語を含むファイルのため Pythonスクリプトで UTF-8 書き込みすること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.3, 5.1, 5.2, 5.3_

  - [ ]* 3.1 DirtyState 管理ロジックのプロパティベーステストを作成する（Property 1）
    - `frontend/frontend/src/__tests__/buyer-detail-save-ux-improvement/dirtyState.property.test.ts` を作成
    - fast-check を使用、`numRuns: 100`
    - **Property 1: DirtyState はフィールド変更後に true になる**
    - `computeDirtyState` 純粋関数を抽出してテスト
    - _Requirements: 1.2, 4.1, 4.2_

  - [ ]* 3.2 DirtyState 管理ロジックのプロパティベーステストを作成する（Property 2）
    - **Property 2: DirtyState は元の値に戻したとき false になる**
    - 変更後に元の値に戻すと `sectionDirtyStates` が false になることを検証
    - _Requirements: 4.3_

  - [ ]* 3.3 保存ペイロードのプロパティベーステストを作成する（Property 3）
    - **Property 3: 保存時は変更フィールドのみが送信される**
    - `buildSavePayload` 純粋関数を抽出してテスト
    - ペイロードのキーが `changedFields` のキーのみであることを検証
    - _Requirements: 2.1, 5.1, 5.2_

  - [ ]* 3.4 保存成功後のリセットのプロパティベーステストを作成する（Property 4）
    - **Property 4: 保存成功後に DirtyState がリセットされる**
    - `applySuccessfulSave` 純粋関数を抽出してテスト
    - _Requirements: 2.3_

  - [ ]* 3.5 保存失敗時の DirtyState 維持のプロパティベーステストを作成する（Property 5）
    - **Property 5: 保存失敗時は DirtyState が維持される**
    - `applyFailedSave` 純粋関数を抽出してテスト
    - _Requirements: 2.5_

  - [ ]* 3.6 isSaving リセットのプロパティベーステストを作成する（Property 6）
    - **Property 6: 保存完了後（成功・失敗問わず）isSaving がリセットされる**
    - 成功・失敗どちらの場合も `sectionSavingStates` が false になることを検証
    - _Requirements: 3.2_

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 5. BuyerDetailPage のセクションヘッダーに SectionSaveButton を組み込む
  - 各セクション（「問合せ内容」「基本情報」「その他」）のヘッダー右端に `SectionSaveButton` を配置
  - 各 `InlineEditableField` に `onChange` を渡し、`handleFieldChange(sectionTitle, ...)` を呼び出す
  - 各セクションの `SectionSaveButton` に `isDirty`, `isSaving`, `onSave` を渡す
  - ⚠️ 日本語を含むファイルのため Pythonスクリプトで UTF-8 書き込みすること
  - _Requirements: 1.1, 1.4, 2.1, 2.2_

- [x] 6. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションのため、スキップ可能（MVP優先の場合）
- 日本語を含むファイル（`BuyerDetailPage.tsx`, `InlineEditableField.tsx`）の編集は必ず Pythonスクリプトで UTF-8 書き込みすること
- バックエンド変更は不要（既存の `buyerApi.update` + `sync: true` で対応）
- プロパティベーステストは `computeDirtyState`, `buildSavePayload`, `applySuccessfulSave`, `applyFailedSave` の純粋関数を別ファイルに抽出してテストする
