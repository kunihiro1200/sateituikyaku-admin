# Bugfix Requirements Document

## Introduction

物件リストのスプレッドシート → データベース同期が正常に動作していない。
現在の実装は `PropertyListingSyncService` を使って Google Sheets API（サービスアカウント認証）経由で同期しているが、エラーが発生して同期が機能していない。

買主リストは GAS（Google Apps Script）がスプレッドシートを直接読み取り、Supabase REST API に upsert する方式に移行済みで正常動作している。物件リストも同じ GAS 方式に移行することで問題を解消する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `EnhancedAutoSyncService.runFullSync()` が Phase 4.5（物件リスト更新同期）を実行する THEN `PropertyListingSyncService.syncUpdatedPropertyListings()` がエラーになり、物件リストがデータベースに同期されない

1.2 WHEN `EnhancedAutoSyncService.runFullSync()` が Phase 4.6（新規物件追加同期）を実行する THEN `PropertyListingSyncService.syncNewProperties()` がエラーになり、新規物件がデータベースに追加されない

1.3 WHEN GAS から物件リストを同期しようとする THEN `gas/` ディレクトリに物件リスト用の GAS スクリプトが存在しないため、GAS 経由の同期ができない

### Expected Behavior (Correct)

2.1 WHEN GAS スクリプト（`PropertyListingSync.gs`）が定期実行される THEN スプレッドシートの「物件」シートを読み取り、Supabase の `property_listings` テーブルに `property_number` をキーとして upsert される

2.2 WHEN GAS スクリプトが実行される THEN 買主リスト（`BuyerSync.gs`）と同じ方式で、スプレッドシートの全行を読み取り、バッチ単位で Supabase REST API に送信される

2.3 WHEN GAS スクリプトが実行される THEN `property-listing-column-mapping.json` のマッピング定義に従い、スプレッドシートのカラム名がデータベースのカラム名に変換される

2.4 WHEN GAS スクリプトが 10 分ごとのトリガーで実行される THEN 同期結果（成功件数・エラー件数・所要時間）がログに記録される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主リストの GAS 同期（`BuyerSync.gs`）が実行される THEN 既存の買主同期は影響を受けず、引き続き正常に動作する

3.2 WHEN `EnhancedAutoSyncService.runFullSync()` が実行される THEN Phase 4.5 / 4.6 のエラーが発生しても、他のフェーズ（売主同期・買主同期など）は引き続き実行される（既存のエラー継続動作は維持）

3.3 WHEN バックエンドの `/api/property-listing-sync/manual` エンドポイントが呼ばれる THEN 既存の `PropertyListingRestSyncService` を使った手動同期は引き続き動作する（GAS 同期と共存）

3.4 WHEN `property_listings` テーブルに既存のレコードがある THEN GAS による upsert は `property_number` をキーとして既存レコードを更新し、データが重複しない
