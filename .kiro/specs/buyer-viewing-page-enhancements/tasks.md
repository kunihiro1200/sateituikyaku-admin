# 実装計画：buyer-viewing-page-enhancements

## 概要

2つのフロントエンドファイルのみを変更する。
1. `BuyersPage.tsx` — `handleRowClick` にナビゲーション分岐を追加
2. `BuyerViewingResultPage.tsx` — ヘッダーに物件所在地の表示を追加

## タスク

- [x] 1. BuyersPage — handleRowClick にナビゲーション分岐を追加
  - `frontend/frontend/src/pages/BuyersPage.tsx` を開く
  - `handleRowClick` 関数を特定し、`selectedCalculatedStatus === '内覧日前日'` の場合に `/buyers/${buyerId}/viewing` へ遷移する分岐を追加する
  - モバイル（カードリスト）・デスクトップ（テーブル）の両方が同じ `handleRowClick` を呼び出していることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 ナビゲーション分岐のプロパティテストを作成する
    - `frontend/frontend/src/__tests__/buyer-viewing-page-enhancements.property.test.tsx` を作成する
    - **Property 2: ナビゲーション先の決定ロジック**
    - fast-check で `buyerNumber`（任意文字列）と `selectedCalculatedStatus`（`'内覧日前日'` または任意文字列または `null`）を生成し、`handleRowClick` 呼び出し後の `navigate` 引数が期待パスと一致することを検証する（numRuns: 100）
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. BuyerViewingResultPage — ヘッダーに物件所在地の表示を追加
  - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` を開く
  - 既存ヘッダー `Box` 内の買主番号 `Chip` の直後に、`linkedProperties.length > 0 && (linkedProperties[0].property_address || linkedProperties[0].address)` が真の場合のみ `Typography` で住所を表示するコードを追加する
  - `property_address` を優先し、存在しない場合は `address` にフォールバックする（`seller-table-column-definition.md` のルールに従う）
  - 既存ヘッダー要素（戻るボタン、タイトル、買主名、買主番号チップ、前日メールボタン）のレイアウトを崩さないことを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.1 物件所在地の表示条件のプロパティテストを作成する
    - 上記テストファイルに追記する
    - **Property 1: 物件所在地の表示条件**
    - fast-check で `linkedProperties`（`property_address` / `address` が空・null・任意文字列のオブジェクト配列）を生成し、表示条件（`length > 0` かつ `property_address || address` が非空）と DOM の住所テキスト存在有無が一致することを検証する（numRuns: 100）
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 備考

- `*` 付きのサブタスクはオプション（スキップ可）
- 変更対象ファイルは2ファイルのみ（バックエンド変更なし）
- `properties` テーブルには `address` カラムが存在しないため、`property_address || address` の形式で参照すること（`seller-table-column-definition.md` 参照）
