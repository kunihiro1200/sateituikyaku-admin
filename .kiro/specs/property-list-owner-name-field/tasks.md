# 実装計画：物件リスト詳細画面の売主氏名フィールド取得ロジック変更

## 概要

`property-listing-column-mapping.json` の重複マッピングを修正し、`PropertyListingSyncService` にBL列優先・O列フォールバックのロジックを追加する。

## タスク

- [x] 1. カラムマッピング設定の修正
  - `backend/src/config/property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションを開き、`●所有者情報` の `seller_name` への重複マッピングを削除する
  - `●所有者情報` → `owner_info` の単一マッピングのみを残す
  - `名前(売主）` → `seller_name` のマッピングが存在することを確認する（括弧混在：半角 `(` と全角 `）`）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. PropertyListingSyncService へのフォールバックロジック追加
  - [x] 2.1 `syncUpdatedPropertyListings()` のバッチ処理内にフォールバックロジックを追加する
    - `columnMapper.mapSpreadsheetToDatabase()` 実行後に `mappedUpdates.seller_name = mappedUpdates.owner_info || mappedUpdates.seller_name || null;` を適用する
    - _Requirements: 1.1, 1.2, 1.3, 3.4, 4.1_

  - [ ]* 2.2 フォールバックロジックのプロパティテストを作成する（fast-check）
    - **Property 1: BL列優先フォールバックロジック**
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.4, 4.2, 4.3**

  - [ ]* 2.3 フォールバックの冪等性プロパティテストを作成する（fast-check）
    - **Property 2: フォールバックの単調性（冪等性）**
    - **Validates: Requirements 1.1, 1.2, 3.4**

  - [x] 2.4 `detectUpdatedPropertyListings()` の変更検出処理内にも同じフォールバックロジックを適用する
    - `seller_name` の比較が正しく行われるよう、変更検出前にフォールバックロジックを適用する
    - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [x] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 4. ユニットテストの作成
  - [ ]* 4.1 フォールバックロジックのユニットテストを作成する
    - BL列あり・O列あり → BL列の値が `seller_name` になること
    - BL列が空・O列あり → O列の値が `seller_name` になること
    - BL列が空・O列も空 → `seller_name` が `null` になること
    - BL列あり・O列が空 → BL列の値が `seller_name` になること
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 4.2 カラムマッピングのユニットテストを作成する
    - `●所有者情報` が `owner_info` にマッピングされること
    - `名前(売主）` が `seller_name` にマッピングされること
    - `●所有者情報` が `seller_name` にマッピングされないこと（重複解消の確認）
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- フォールバックロジックは `syncUpdatedPropertyListings()` と `detectUpdatedPropertyListings()` の両方に適用すること
- エラーハンドリングは既存パターンをそのまま踏襲する（変更不要）
- `sellers` テーブルの暗号化フィールドを扱う場合は必ず復号してから保存すること（encryption-key-protection.md 参照）
