# 実装計画：売主リスト近隣買主PDFヘッダー物件住所表示

## 概要

`nearbyBuyersPrintUtils.ts` の `buildPrintContent` 関数に `propertyAddress` 引数を追加し、`NearbyBuyersList.tsx` からその値を渡すことで、PDF印刷プレビューのヘッダーに物件住所を表示する。変更対象は2ファイルのみ。

## タスク

- [x] 1. `buildPrintContent` 関数に `propertyAddress` 引数を追加し、ヘッダーHTMLを生成する
  - `frontend/frontend/src/components/nearbyBuyersPrintUtils.ts` を編集する
  - 関数シグネチャの末尾に `propertyAddress?: string | null` を追加する（後方互換性を維持）
  - `propertyAddress` が有効な文字列（trim後に非空）の場合、会社情報ブロックの下に `{propertyAddress}の近隣にお問合せ合った買主様` という見出しHTMLを生成する
  - 見出しのフォントサイズは18px以上、適切な余白を設ける
  - `null` / `undefined` / 空文字 / 空白のみの場合は見出しを生成しない
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 プロパティ1のテストを書く：後方互換性の維持
    - **Property 1: 後方互換性の維持**
    - `propertyAddress` を渡さない場合と `undefined` を渡した場合で同一HTMLが生成されること
    - **Validates: Requirements 1.3, 4.5**

  - [ ]* 1.2 プロパティ2のテストを書く：有効な物件住所の見出し表示
    - **Property 2: 有効な物件住所の見出し表示**
    - 任意の非空文字列 `propertyAddress` を渡したとき、生成HTMLに `{propertyAddress}の近隣にお問合せ合った買主様` が含まれ、font-sizeが18px以上であること
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 1.3 プロパティ3のテストを書く：無効な物件住所での見出し非表示
    - **Property 3: 無効な物件住所での見出し非表示**
    - `null` / `undefined` / 空文字 / 空白のみの文字列を渡したとき、生成HTMLに `の近隣にお問合せ合った買主様` が含まれないこと
    - **Validates: Requirements 2.4, 1.2**

  - [ ]* 1.4 プロパティ4のテストを書く：既存テーブル列の維持
    - **Property 4: 既存テーブル列の維持**
    - 任意の buyers リストと選択状態に対して、生成HTMLに `買主番号` `名前` `受付日` `問合せ物件情報` `ヒアリング/内覧結果` `最新状況` の全列ヘッダーが含まれること
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 2. `NearbyBuyersList.tsx` の `handlePrint` 関数を更新する
  - `frontend/frontend/src/components/NearbyBuyersList.tsx` を編集する
  - `buildPrintContent` の呼び出しに `propertyAddress` を追加引数として渡す
  - 新たなAPIコールは行わない（既存 state の値をそのまま渡す）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- プロパティベーステストには [fast-check](https://github.com/dubzzz/fast-check) を使用する
- バックエンド変更は不要
