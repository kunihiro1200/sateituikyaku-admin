# バグ修正要件ドキュメント

## はじめに

買主リストのスプレッドシートにおいて、AT列（物件番号）に値が入力されているにもかかわらず、以下の3列が空白のままになるバグ。

- AY列「物件所在地」
- BQ列「住居表示」
- BR列「価格」

コード調査の結果、2つの問題が重なっていることが判明した：

**問題1**: `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `display_address`（住居表示）のマッピングが欠落している。`spreadsheetToDatabaseExtended` には `"住居表示": "display_address"` が定義されているが、逆方向（DB→スプレッドシート）のマッピングが存在しない。

**問題2**: DBに `property_number` が保存された際に、`property_listings` テーブルから関連する物件情報（`address`/`display_address`/`price`）を取得して `buyers` テーブルの `property_address`・`display_address`・`price` フィールドに書き込み、スプレッドシートに同期する処理が存在しない。現在の実装では、`BuyerService.updateWithSync()` は更新されたフィールドのみをスプレッドシートに書き戻すため、`property_number` を保存しても物件情報は自動的に反映されない。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN スプレッドシートのAY列（物件所在地）は空白のまま更新されない

1.2 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN スプレッドシートのBQ列（住居表示）は空白のまま更新されない

1.3 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN スプレッドシートのBR列（価格）は空白のまま更新されない

1.4 WHEN `BuyerWriteService.updateFields()` が `display_address` フィールドを含む更新データを受け取る THEN `BuyerColumnMapper.mapDatabaseToSpreadsheet()` は `display_address` に対応するスプレッドシート列名を返せず、スプレッドシートへの書き込みがスキップされる

### 期待される動作（正しい動作）

2.1 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN システムは `property_listings` テーブルから対応する物件の `address` を取得し、スプレッドシートのAY列（物件所在地）に反映する SHALL

2.2 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN システムは `property_listings` テーブルから対応する物件の `display_address` を取得し、スプレッドシートのBQ列（住居表示）に反映する SHALL

2.3 WHEN DBから買主の `property_number`（物件番号）を入力・保存する THEN システムは `property_listings` テーブルから対応する物件の `price` を取得し、スプレッドシートのBR列（価格）に反映する SHALL

2.4 WHEN `BuyerColumnMapper.mapDatabaseToSpreadsheet()` が `display_address` フィールドを含むレコードを受け取る THEN システムは `display_address` を `住居表示` 列にマッピングして返す SHALL

### 変更されない動作（リグレッション防止）

3.1 WHEN `property_number` を含まない買主フィールド（例：`viewing_date`、`latest_status`、`next_call_date` など）を更新する THEN システムは既存の通り、更新されたフィールドのみをスプレッドシートに同期し続ける SHALL CONTINUE TO

3.2 WHEN `property_number` が空白または null の状態で買主データを更新する THEN システムは物件情報の取得・同期を行わず、他のフィールドの同期は正常に動作し続ける SHALL CONTINUE TO

3.3 WHEN スプレッドシートから買主データをDBに同期する（スプシ→DB方向） THEN システムは既存の `spreadsheetToDatabase` および `spreadsheetToDatabaseExtended` マッピングを使用して正常に動作し続ける SHALL CONTINUE TO

3.4 WHEN `databaseToSpreadsheet` マッピングに既存のフィールド（`property_address`、`price` など）が含まれる THEN システムはそれらのフィールドを引き続き正しくスプレッドシートに書き込み続ける SHALL CONTINUE TO
