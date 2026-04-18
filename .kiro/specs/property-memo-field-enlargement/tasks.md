# 実装計画：備忘録フィールド拡大機能

## 概要

`PropertyListingDetailPage.tsx` の備忘録フィールドの `rows={2}` を `rows={6}` に変更する。単一ファイル・単一箇所の変更。

## タスク

- [x] 1. 備忘録フィールドの `rows` 属性を変更する
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の備忘録 `TextField` コンポーネントの `rows={2}` を `rows={6}` に変更する
  - `fullWidth`、`multiline`、`value`、`onChange`、`placeholder`、`sx` の各属性は変更しない
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. チェックポイント - テストを実施し、問題があればユーザーに確認する
  - [ ]* 2.1 備忘録フィールドの単体テストを作成する
    - 備忘録フィールドの `rows` 属性が6以上であることを確認
    - 備忘録フィールドの行数が特記フィールドの行数より多いことを確認
    - `fullWidth`、`multiline`、`placeholder`、`fontSize` が変更前と同じであることを確認
    - `memo` フィールドに値を入力した後、保存ボタンが有効化されることを確認
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - すべてのテストが通ることを確認し、問題があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 変更箇所は1ファイル1行のみ（行2282付近）
