# 実装計画: 業務詳細画面「契約決済」タブのフィールド非表示

## 概要

`WorkTaskDetailModal.tsx` の「契約決済」タブから6つの不要フィールドのJSXを削除する。
バックエンド変更なし、フロントエンドのみの変更。

## タスク

- [x] 1. 対象JSXの削除
  - [x] 1.1 `EditableYesNo` (hirose_request_sales) を削除する
    - `WorkTaskDetailModal.tsx` の ContractSettlementSection 相当部分から `field="hirose_request_sales"` の `EditableYesNo` コンポーネントを削除する
    - _Requirements: 1.1_

  - [x] 1.2 `EditableYesNo` (cw_request_sales) を削除する
    - `field="cw_request_sales"` の `EditableYesNo` コンポーネントを削除する
    - _Requirements: 2.1_

  - [x] 1.3 作業内容 Grid コンテナを削除する
    - 「作業内容」ラベルと ButtonGroup（書類取得のみ／入力のみ／両方）を含む `Grid container` 全体を削除する
    - _Requirements: 3.1_

  - [x] 1.4 `EditableField` (attachment_prep_deadline) を削除する
    - `field="attachment_prep_deadline"` の `EditableField` コンポーネントを削除する
    - _Requirements: 4.1_

  - [x] 1.5 `EditableField` (attachment_completed) を削除する
    - `field="attachment_completed"` の `EditableField` コンポーネントを削除する
    - _Requirements: 5.1_

  - [x] 1.6 `EditableField` (attachment_printed) を削除する
    - `field="attachment_printed"` の `EditableField` コンポーネントを削除する
    - _Requirements: 6.1_

- [x] 2. 残存フィールドの表示確認
  - [x] 2.1 削除後の残存フィールド順序を確認する
    - 設計ドキュメントの「削除後の残存フィールド順序」に従い、製本予定日・決済日・売買価格など残存フィールドが正しい順序で残っていることをコードレビューで確認する
    - _Requirements: 7.1_

  - [ ]* 2.2 残存フィールドのユニットテストを書く
    - `WorkTaskDetailModal` のレンダリングテストで、削除した6フィールドが存在しないこと、および残存フィールドが存在することをアサートする
    - 削除フィールド: `hirose_request_sales`, `cw_request_sales`, 「作業内容」, `attachment_prep_deadline`, `attachment_completed`, `attachment_printed`
    - 残存フィールド: 製本予定日・決済日・売買価格など
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_

- [x] 3. チェックポイント - 動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。
  - バックエンドファイル（`backend/` 配下）に変更がないことを確認する。
  - _Requirements: 7.3_

## Notes

- `*` 付きタスクはオプションであり、MVP優先の場合はスキップ可能
- バックエンド・DBスキーマ・型定義への変更は一切行わない（要件7.3）
- 設計ドキュメントの「約780〜840行付近」を参考に対象箇所を特定すること
