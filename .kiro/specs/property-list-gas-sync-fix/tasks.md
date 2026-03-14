# 実装計画

- [x] 1. バグ条件の探索テスト（修正前にエラーを確認）
  - **Property 1: Bug Condition** - GAS スクリプト不在・PropertyListingSyncService エラー
  - **重要**: このテストは修正前の未修正コードで実行する
  - **目標**: バグが実際に存在することを確認し、根本原因を特定する
  - **Scoped PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケースに絞って確認する
  - 確認1: `gas/property-listing-sync/` ディレクトリが存在しないことを確認（`gas/` ディレクトリを一覧表示）
  - 確認2: `gas/buyer-sync/BuyerSync.gs` が存在することを確認（比較基準）
  - 確認3: バックエンドのログで Phase 4.5 / 4.6 のエラーメッセージを確認（`EnhancedAutoSyncService` のログ）
  - 確認4: `PropertyListingSyncService` がどのようなエラーを返しているか特定する
  - **期待される結果**: テスト失敗（バグが存在することを確認）
  - 発見した反例を記録する（例: 「`gas/property-listing-sync/PropertyListingSync.gs` が存在しない」）
  - テストを書いて実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保存テスト（修正前に既存動作を確認）
  - **Property 2: Preservation** - 既存同期への影響なし
  - **重要**: 観察優先アプローチに従い、修正前の未修正コードで実行する
  - 観察1: `gas/buyer-sync/BuyerSync.gs` のファイルハッシュ（または最終更新日時）を記録する
  - 観察2: `backend/src/services/EnhancedAutoSyncService.ts` のファイルハッシュを記録する
  - 観察3: `backend/src/services/PropertyListingRestSyncService.ts` のファイルハッシュを記録する
  - 観察4: `/api/property-listing-sync/manual` エンドポイントが応答することを確認する
  - 保存テストを書く: 上記3ファイルが変更されていないことを検証するプロパティテスト
  - 未修正コードでテストを実行し、**PASS することを確認**する
  - **期待される結果**: テスト PASS（これが修正後も維持すべきベースライン）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. `PropertyListingSync.gs` の新規作成と動作確認

  - [x] 3.1 `gas/property-listing-sync/PropertyListingSync.gs` を新規作成する
    - `gas/buyer-sync/BuyerSync.gs` と同じ構造で実装する
    - `CONFIG.SHEET_NAME` = `'物件'`、`CONFIG.TABLE_NAME` = `'property_listings'` に設定する
    - `CONFIG.SPREADSHEET_ID`、`CONFIG.SUPABASE_URL`、`CONFIG.SUPABASE_SERVICE_KEY` は `BuyerSync.gs` と同じ値を使用する
    - `COLUMN_MAPPING` は `backend/src/config/property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションをそのまま定義する
    - `TYPE_CONVERSIONS` は `property-listing-column-mapping.json` の `typeConversions` セクションをそのまま定義する
    - メイン関数名を `syncPropertyListings()` とする（`syncBuyers()` に相当）
    - `property_number` が空の行はスキップする（`BuyerSync.gs` の `buyer_number` チェックと同じパターン）
    - バッチ単位（100件）で `upsertToSupabase()` を呼び出す
    - `Prefer: resolution=merge-duplicates` ヘッダーで `property_number` をキーとして upsert する
    - `setupTrigger()` 関数: ハンドラ関数名を `syncPropertyListings` に変更し、10分ごとのトリガーを設定する
    - `testSync()` 関数: `syncPropertyListings()` を呼び出す
    - `syncSingleProperty(propertyNumber)` 関数: デバッグ用に特定の物件番号だけ同期する
    - _Bug_Condition: `gas/property-listing-sync/PropertyListingSync.gs` が存在しない（design.md の Bug Condition より）_
    - _Expected_Behavior: スプレッドシートの「物件」シートを読み取り、`property_listings` テーブルに `property_number` をキーとして upsert される（design.md の Expected Behavior より）_
    - _Preservation: `BuyerSync.gs`・`EnhancedAutoSyncService`・`PropertyListingRestSyncService` は変更しない（design.md の Preservation Requirements より）_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - GAS による物件リスト upsert
    - **重要**: タスク1で書いたテストをそのまま再実行する（新しいテストは書かない）
    - `gas/property-listing-sync/PropertyListingSync.gs` が存在することを確認する
    - GAS エディタで `testSync()` を手動実行し、ログに「同期完了」が出力されることを確認する
    - `property_listings` テーブルにレコードが upsert されていることを Supabase で確認する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3 の Expected Behavior Properties より_

  - [x] 3.3 保存テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存同期への影響なし
    - **重要**: タスク2で書いたテストをそのまま再実行する（新しいテストは書かない）
    - `BuyerSync.gs`・`EnhancedAutoSyncService`・`PropertyListingRestSyncService` のファイルハッシュが変更前と同一であることを確認する
    - **期待される結果**: テスト PASS（既存動作に影響がないことを確認）
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク1のバグ条件テストが PASS していることを確認する（修正後）
  - タスク2の保存テストが PASS していることを確認する（修正後）
  - GAS エディタで `setupTrigger()` を実行し、10分ごとのトリガーが設定されていることを確認する
  - 疑問点があればユーザーに確認する
