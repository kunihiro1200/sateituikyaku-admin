# 実装計画: buyer-calendar-agency-inquiry-title

## 概要

`BuyerViewingResultPage.tsx` に `applyAgencyInquiryTitle` 純粋関数を追加し、`handleCalendarButtonClick` 内で呼び出すことで、業者問合せ時のカレンダータイトルに氏名・会社名を付与する。

## タスク

- [x] 1. `applyAgencyInquiryTitle` 関数の実装と統合
  - [x] 1.1 `applyAgencyInquiryTitle` 純粋関数を `BuyerViewingResultPage.tsx` に追加する
    - `broker_inquiry === '業者問合せ'` かつ `buyerName` が非空の場合のみ `${baseTitle} ${buyerName}` を返す
    - それ以外（null/undefined/空文字/空白のみ/業者問合せ以外）はすべて `baseTitle` をそのまま返す
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 Property 1 のプロパティテストを書く（fast-check）
    - **Property 1: 業者問合せかつ name が非空の場合、タイトルに name がスペース区切りで追加される**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 1.3 Property 2 のプロパティテストを書く（fast-check）
    - **Property 2: name が空/null の場合はタイトルを変更しない**
    - **Validates: Requirements 1.2**

  - [ ]* 1.4 Property 3 のプロパティテストを書く（fast-check）
    - **Property 3: broker_inquiry が '業者問合せ' 以外の任意の値の場合はタイトルを変更しない**
    - **Validates: Requirements 1.3**

  - [x] 1.5 `handleCalendarButtonClick` 内で `applyAgencyInquiryTitle` を呼び出すよう変更する
    - `const title = generateCalendarTitle(...)` を `const baseTitle = ...` に変更し、`const title = applyAgencyInquiryTitle(baseTitle, buyer.broker_inquiry, buyer.name)` を追加する
    - `text` パラメータ以外（`details`、`location`、`dates`、`add`）は変更しない
    - _Requirements: 1.1, 1.5_

- [x] 2. チェックポイント
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのタスクはオプションであり、MVP優先の場合はスキップ可能
- プロパティテストには fast-check を使用（最低 100 イテレーション）
- 変更対象ファイルは `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のみ
