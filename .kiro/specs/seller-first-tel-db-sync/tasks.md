# 実装計画: seller-first-tel-db-sync

## 概要

売主リストスプレッドシートのY列（「一番TEL」）をSupabase DBの`sellers.first_call_initials`カラムへ一括同期する`syncFirstTelToDb`関数を、既存の`gas_seller_complete_code.js`に追加する。

既存の`SUPABASE_CONFIG`・`rowToObject`・`formatDateToISO_`・`patchSellerToSupabase_`を再利用し、手動実行専用の独立関数として実装する。

## タスク

- [x] 1. DBマイグレーションSQLの作成
  - `sellers`テーブルに`first_call_initials VARCHAR(10)`カラムを追加するSQLファイルを作成する
  - ファイル名: `backend/add-first-call-initials-column.sql`
  - `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_call_initials VARCHAR(10);` を記述する
  - _Requirements: 4.1, 4.2_

- [x] 2. ヘルパー関数の実装（純粋関数として切り出し）
  - [x] 2.1 `isValidSellerNumber(sellerNumber)` 関数を実装する
    - `/^[A-Z]{2}\d+$/` 正規表現でバリデーションを行う
    - `gas_seller_complete_code.js` 内に追加する
    - _Requirements: 1.4_

  - [ ]* 2.2 `isValidSellerNumber` のプロパティテストを書く
    - **Property 2: 売主番号バリデーションの正確性**
    - **Validates: Requirements 1.4**
    - fast-checkを使用し、任意の文字列に対して正規表現と関数の結果が一致することを検証する

  - [x] 2.3 `isTargetRecord(inquiryDateValue)` 関数を実装する
    - `formatDateToISO_()` を使って変換し、`>= '2026-01-01'` かどうかを返す
    - 空欄・無効値は `false` を返す
    - `gas_seller_complete_code.js` 内に追加する
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 2.4 `isTargetRecord` のプロパティテストを書く
    - **Property 1: 日付フィルタの正確性**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - fast-checkを使用し、2026-01-01以降の日付・以前の日付・null・無効文字列を生成して検証する

  - [x] 2.5 `buildUpdateData(rowObj)` 関数を実装する
    - `rowObj['一番TEL']` が非空文字列なら `{ first_call_initials: value }` を返す
    - 空欄なら `{ first_call_initials: null }` を返す
    - `first_call_initials` キーのみを含むオブジェクトを返す
    - `gas_seller_complete_code.js` 内に追加する
    - _Requirements: 2.1, 2.2, 2.3, 5.2_

  - [ ]* 2.6 `buildUpdateData` のプロパティテストを書く
    - **Property 3: 一番TEL値のマッピング正確性**
    - **Validates: Requirements 2.1, 2.2, 5.2**
    - fast-checkを使用し、任意の`'一番TEL'`値に対してキーが`first_call_initials`のみであること・値のマッピングが正しいことを検証する

- [x] 3. チェックポイント - ヘルパー関数の動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 4. `syncFirstTelToDb` メイン関数の実装
  - [x] 4.1 関数の骨格と開始ログを実装する
    - `function syncFirstTelToDb()` を `gas_seller_complete_code.js` に追加する
    - 開始時刻の記録と `Logger.log` への出力を実装する
    - カウンター変数（`targetCount`, `updatedCount`, `skippedCount`, `errorCount`）を初期化する
    - _Requirements: 3.1, 3.2_

  - [x] 4.2 シート取得とデータ読み込みを実装する
    - `SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト')` でシートを取得する
    - シートが存在しない場合は `Logger.log('❌ シート「売主リスト」が見つかりません')` を出力して即時終了する
    - `rowToObject()` を使って全行をオブジェクト配列に変換する
    - _Requirements: 3.5_

  - [x] 4.3 レコードのフィルタリングとDB更新ループを実装する
    - 各行に対して `isValidSellerNumber()` でバリデーションを行い、不一致はスキップ
    - `isTargetRecord()` で反響日付フィルタを適用し、対象外はスキップ
    - `buildUpdateData()` で `updateData` を構築する
    - `patchSellerToSupabase_(sellerNumber, updateData)` を呼び出す
    - 戻り値の `success` を確認し、成功なら `updatedCount++`、失敗なら `errorCount++` と `Logger.log` エラー出力
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 2.5, 3.4, 3.6, 5.1, 5.2, 5.3_

  - [x] 4.4 サマリーログと終了処理を実装する
    - 処理終了時刻・合計処理時間・対象数・更新数・スキップ数・エラー数を `Logger.log` に出力する
    - _Requirements: 3.2, 3.3_

  - [ ]* 4.5 エラー継続性のプロパティテストを書く
    - **Property 4: エラー時の処理継続性**
    - **Validates: Requirements 2.5**
    - `patchSellerToSupabase_` をモックし、一部レコードでエラーを返した場合でも残りのレコードが処理されることを検証する

  - [ ]* 4.6 ログ統計正確性のプロパティテストを書く
    - **Property 5: ログ統計の正確性**
    - **Validates: Requirements 3.2, 3.3**
    - 任意のレコードセットに対して、更新数＋スキップ数＋エラー数の合計が入力レコード総数と一致することを検証する

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは要件との対応関係を明記している
- `gas_seller_complete_code.js` は `.kiroignore` で除外されているため、実装時はユーザーが直接ファイルを開いて確認すること
- DBマイグレーション（タスク1）はGASスクリプト実行前に適用すること
- プロパティテストはNode.js環境でfast-checkを使用して実行する（GAS環境外）
