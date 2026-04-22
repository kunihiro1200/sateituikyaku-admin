# 実装計画: business-loan-field-readonly

## 概要

`WorkTaskDetailModal.tsx` の `SellerBuyerDetailSection` 内にある「ローン」フィールドを `EditableButtonSelect` から `ReadOnlyDisplayField` に変更する。変更箇所は1行のみ。

## タスク

- [x] 1. loan フィールドを ReadOnlyDisplayField に変更する
  - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を開く
  - `SellerBuyerDetailSection` 内の以下の行を変更する
    - 変更前: `<EditableButtonSelect label="ローン" field="loan" options={['あり', 'なし']} />`
    - 変更後: `<ReadOnlyDisplayField label="ローン" value={getValue('loan') || '-'} />`
  - `ReadOnlyDisplayField` は同ファイル内に既に定義済みのため、インポート追加は不要
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. 動作確認・チェックポイント
  - [ ] 2.1 ローンフィールドが読み取り専用テキストとして表示されることを確認する
    - `loan = 'あり'` のデータで画面を開き、テキスト「あり」が表示されること
    - `loan = 'なし'` のデータで画面を開き、テキスト「なし」が表示されること
    - `loan = null` のデータで画面を開き、ハイフン「-」が表示されること
    - ボタン要素（`EditableButtonSelect`）が表示されないこと
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 2.2 ユニットテストを作成する
    - テスト1: `loan = 'あり'` で `ReadOnlyDisplayField` が表示され、`EditableButtonSelect` が存在しないこと
    - テスト2: `loan = 'なし'` でテキスト「なし」が表示されること
    - テスト3: `loan = null` でハイフン「-」が表示されること
    - テスト4: ローンフィールド周辺に `<button>` や `<input>` が存在しないこと
    - テスト5: `financial_institution` フィールドが引き続き `<input>` として存在すること
    - テスト6: 保存時のAPIペイロードに `loan` が含まれないこと
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 3.1, 3.2, 3.3_
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 変更対象ファイルは `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の1箇所のみ
- バックエンド・GASの変更は不要
