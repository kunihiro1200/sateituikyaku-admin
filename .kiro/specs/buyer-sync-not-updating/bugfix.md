# Bugfix Requirements Document

## Introduction

買主リスト（`buyers`テーブル）の自動同期が正しく動作しておらず、スプレッドシートに存在する買主番号がデータベースに追加されない問題。例えば買主番号7137はスプレッドシートに存在するが、データベースに該当レコードが全く存在しない。

買主同期は売主同期（`EnhancedAutoSyncService.runFullSync`）とは完全に独立した仕組みで動作しており、Vercel Cron Job（`/api/cron/buyer-sync`、10分ごと）によって `BuyerSyncService.syncAll()` が呼び出される。この同期は全件upsert方式のため新規レコードも追加されるべきだが、何らかの理由でスプレッドシートの特定行が処理されていないか、upsertのinsert部分が機能していない可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートに買主番号7137が存在する状態で自動同期が実行された THEN システムはデータベースに買主番号7137のレコードを追加しない

1.2 WHEN `BuyerSyncService.syncAll()` が全件upsertを実行した THEN システムはスプレッドシートに存在する一部の買主番号をデータベースに挿入しない

1.3 WHEN `/api/cron/buyer-sync` が実行された THEN システムは同期が成功したように見えるが、スプレッドシートに存在する買主番号がデータベースに存在しないままになる

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートに買主番号7137が存在する状態で自動同期が実行された THEN システムはデータベースに買主番号7137のレコードを新規追加する

2.2 WHEN `BuyerSyncService.syncAll()` が全件upsertを実行した THEN システムはスプレッドシートの全買主番号に対応するレコードをデータベースに挿入または更新する

2.3 WHEN `/api/cron/buyer-sync` が実行された THEN システムはスプレッドシートに存在する全買主がデータベースに存在する状態を保証する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主番号（`buyer_number`）が空のスプレッドシート行が存在する THEN システムはその行をスキップし続ける

3.2 WHEN 同期が既に実行中（`isSyncInProgress() === true`）の状態で再度Cron Jobが呼ばれた THEN システムは重複実行を防ぐため新しい同期をスキップし続ける

3.3 WHEN 個別の行の処理でエラーが発生した THEN システムはそのエラーをログに記録しつつ、残りの行の処理を継続し続ける

3.4 WHEN 同期が正常に完了した THEN システムは `buyer_sync_logs` テーブルに同期結果（作成数・更新数・失敗数）を記録し続ける

3.5 WHEN データベースに既に存在する買主番号のデータがスプレッドシートで更新された THEN システムは既存レコードを最新の値に更新し続ける
