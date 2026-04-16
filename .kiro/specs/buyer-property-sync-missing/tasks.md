# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - property_number保存時の物件情報スプレッドシート同期欠落
  - **重要**: このテストは未修正コードで**必ず失敗する** - 失敗がバグの存在を証明する
  - **修正を試みないこと** - テストが失敗してもコードを修正しない
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ**: `property_number` が非null・非空文字で保存される具体的なケースに絞る
  - テスト1: `BuyerColumnMapper.mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" })` を呼び出し、結果に `住居表示` キーが存在しないことを確認（未修正コードで失敗するはず）
  - テスト2: `BuyerService.updateWithSync()` で `property_number` を更新した際、`writeService.updateFields()` に渡される `updates` に `property_address`/`display_address`/`price` が含まれないことを確認
  - テスト3: `BuyerColumnMapper` の `dbToSpreadsheet` マップに `display_address` キーが存在しないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（これが正しい - バグの存在を証明する）
  - 発見したカウンターエグザンプルを記録する（例: `mapDatabaseToSpreadsheet({ display_address: "..." })` が `{}` を返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非property_numberフィールド更新の既存動作維持
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`property_number` を含まない更新）の動作を観察する
  - 観察1: `viewing_date` を更新した際、`writeService.updateFields()` に渡される `updates` に `property_address`/`display_address`/`price` が含まれないことを確認
  - 観察2: `latest_status` を更新した際、既存通り更新フィールドのみが同期されることを確認
  - 観察3: `property_number: null` で更新した際、物件情報の取得処理がスキップされることを確認
  - 観察4: `mapDatabaseToSpreadsheet({ property_address: "大分市..." })` が引き続き `{ "物件所在地": "大分市..." }` を返すことを確認
  - プロパティベーステスト: `property_number` を含まない任意のフィールド更新では `property_address`/`display_address`/`price` が `allowedData` に追加されないことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが通過する（ベースライン動作を確認する）
  - テストを作成・実行し、未修正コードで通過したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. buyer-property-sync-missingバグの修正

  - [x] 3.1 `buyer-column-mapping.json` に `display_address` マッピングを追加する
    - `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションを開く
    - 既存の `"price": "価格"` の近くに `"display_address": "住居表示"` を追加する
    - `spreadsheetToDatabaseExtended` の `"住居表示": "display_address"` と対称になるよう確認する
    - _Bug_Condition: `mapDatabaseToSpreadsheet({ display_address: "..." })` が `{}` を返す（`住居表示` キーなし）_
    - _Expected_Behavior: `mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" })` が `{ "住居表示": "中央1-1-1" }` を返す_
    - _Preservation: `databaseToSpreadsheet` の既存フィールド（`property_address`、`price` など）は変更しない_
    - _Requirements: 2.4_

  - [x] 3.2 `BuyerService.updateWithSync()` に `property_number` 保存時の物件情報取得・同期処理を追加する
    - `backend/src/services/BuyerService.ts` の `updateWithSync()` メソッドを開く
    - `allowedData` に `property_number` が含まれ、かつ値が非null・非空文字かチェックする条件分岐を追加する
    - 条件が真の場合、`property_listings` テーブルから `address`/`display_address`/`price` を取得する
    - 取得した値を `buyers` テーブルの `property_address`/`display_address`/`price` に書き込む処理を追加する
    - `allowedData` に `property_address`/`display_address`/`price` を追加して既存の同期フロー（`writeService.updateFields()`）に乗せる
    - 処理タイミング: DB更新（`supabase.from('buyers').update()`）の前に物件情報を取得し `allowedData` に追加する
    - `property_number` が null/空文字の場合は物件情報の取得・同期をスキップする
    - `property_listings` に対応物件が存在しない場合はエラーにせず、`property_number` のみを保存して処理を継続する
    - _Bug_Condition: `isBugCondition(input)` where `input.fieldName = 'property_number' AND input.value IS NOT NULL AND input.value != ''`_
    - _Expected_Behavior: `updateWithSync()` 後にスプレッドシートのAY列（物件所在地）・BQ列（住居表示）・BR列（価格）が `property_listings` の値で更新される_
    - _Preservation: `property_number` を含まないフィールド更新では `allowedData` に物件情報が追加されない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - property_number保存時の物件情報スプレッドシート同期
    - **重要**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが通過すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが通過する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 保全テストが引き続き通過することを確認する
    - **Property 2: Preservation** - 非property_numberフィールド更新の既存動作維持
    - **重要**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが通過する（リグレッションがないことを確認する）
    - 修正後もすべてのテストが通過することを確認する

- [x] 4. チェックポイント - すべてのテストが通過することを確認する
  - すべてのテストが通過することを確認する
  - 疑問点があればユーザーに確認する
