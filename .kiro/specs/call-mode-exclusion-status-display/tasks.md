# 実装計画：通話モード除外ステータス表示

## 概要

`CallModePage.tsx` のみを変更対象として、除外済み状態の表示ロジックを拡張する。
`editedStatus` に「除外」が含まれる場合は既存の `ExclusionActionBanner` を非表示にし、代わりに `editedStatus` の値を赤字テキストで表示する。

## タスク

- [x] 1. 表示判定ロジックの実装と ExclusionStatusDisplay の追加
  - [x] 1.1 CallModePage.tsx に派生値（`isExcluded`, `showBanner`, `showStatusDisplay`）を追加する
    - `editedStatus?.includes('除外') ?? false` で `isExcluded` を算出
    - `!isExcluded && !!exclusionAction` で `showBanner` を算出
    - `isExcluded` をそのまま `showStatusDisplay` に代入
    - 既存の `{exclusionAction && (...)}` を `{showBanner && (...)}` に変更
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 ExclusionStatusDisplay の JSX を追加する
    - `{showStatusDisplay && (<Typography variant="body2" sx={{ color: 'error.main' }}>{editedStatus}</Typography>)}` を ExclusionActionBanner の直後に追加
    - `border` プロパティは設定しない
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.3 プロパティテスト：排他制御の不変条件（プロパティ1）
    - **Property 1: 排他制御の不変条件**
    - `showBanner` と `showStatusDisplay` が同時に `true` にならないことを検証
    - `fc.string()` × 2 で任意の `editedStatus` / `exclusionAction` を生成
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 1.4 プロパティテスト：除外状態の部分一致判定（プロパティ2）
    - **Property 2: 除外状態の部分一致判定**
    - 「除外」を含む任意の文字列に対して `isExcluded === true`、`showStatusDisplay === true`、`showBanner === false` を検証
    - **Validates: Requirements 1.1, 1.3, 2.1, 3.2**

  - [ ]* 1.5 プロパティテスト：非除外状態でのバナー表示（プロパティ3）
    - **Property 3: 非除外状態でのバナー表示**
    - 「除外」を含まない文字列 × 空でない `exclusionAction` に対して `showBanner === true`、`showStatusDisplay === false` を検証
    - **Validates: Requirements 1.2, 2.5, 3.3**

- [x] 2. チェックポイント
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 変更対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ
- バックエンド変更は不要
- プロパティテストには `fast-check` を使用（プロジェクト既存ライブラリ）
