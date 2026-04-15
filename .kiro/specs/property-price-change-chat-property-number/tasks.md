# 実装計画：チャットメッセージへの物件番号表示

## 概要

`PriceSection.tsx` 内の `handleSendPriceReductionChat` 関数のメッセージ組み立て部分と、確認ダイアログのプレビュー表示に物件番号行を先頭に追加する。変更対象は `PriceSection.tsx` のみ。

## タスク

- [x] 1. PriceSection.tsx のメッセージ組み立てロジックを修正する
  - `handleSendPriceReductionChat` 内の `message.text` の先頭に `物件番号：${propertyNumber}\n` を追加する
  - `propertyNumber` が空文字の場合は物件番号行を省略するフォールバック処理を実装する
  - 確認ダイアログ（`confirmDialogOpen`）のプレビュー表示にも同様の物件番号行を先頭に追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1_

  - [ ]* 1.1 Property 1 のプロパティテストを書く
    - **Property 1: メッセージ先頭行の物件番号フォーマット**
    - **Validates: Requirements 1.1, 1.2**
    - `buildChatMessage` を純粋関数として抽出し、fast-check で任意の有効な物件番号に対してメッセージ先頭行が `物件番号：{propertyNumber}` になることを検証する

  - [ ]* 1.2 Property 2 のプロパティテストを書く
    - **Property 2: 既存コンテンツの保持**
    - **Validates: Requirements 1.3, 3.1**
    - 任意の物件番号・値下げ履歴・住所・URLの組み合わせに対して、既存のメッセージ本文（`【値下げ通知】`、値下げ履歴、住所、URL）がすべてメッセージ内に含まれることを検証する

  - [ ]* 1.3 Property 3 のプロパティテストを書く
    - **Property 3: 物件番号なし時のフォールバック**
    - **Validates: Requirements 1.4**
    - 空文字列の物件番号に対して、生成されたメッセージに `物件番号：` が含まれないことを検証する

- [x] 2. 最終チェックポイント
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプションであり、MVP向けにスキップ可能
- `PropertyListingDetailPage.tsx` の変更は不要（すでに `propertyNumber` を props として渡している）
- プロパティテストには fast-check を使用する
