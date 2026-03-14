# Bugfix Requirements Document

## Introduction

買主リストにおいて、スプレッドシートに追加された新規レコードがデータベースに同期されないバグ。

`BuyerSyncService.processBatch()` は `upsert({ onConflict: 'buyer_number' })` を使用しており、新規レコードの挿入ロジック自体は正しく実装されている。しかし、定期同期スケジューラー（`setInterval`）が `backend/src/index.ts` の `if (process.env.VERCEL !== '1')` ブロック内にのみ存在するため、本番環境（Vercel）ではサーバーレス関数の性質上 `setInterval` が動作せず、定期同期が一切実行されない。その結果、スプレッドシートに追加された新規買主レコードがデータベースに反映されず、1週間以上前のデータも同期されていない状態が続いている。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 本番環境（Vercel）でサーバーが起動する THEN 買主リストの定期同期スケジューラー（`setInterval`）が起動しない（`VERCEL !== '1'` ブロック外にスケジューラーが存在しないため）

1.2 WHEN スプレッドシートの買主リストに新規レコードが追加される THEN 本番環境のデータベースに新規レコードが挿入されない（定期同期が実行されないため）

1.3 WHEN 本番環境で買主リストページを閲覧する THEN スプレッドシートに追加された新規買主が表示されない（データベースに存在しないため）

### Expected Behavior (Correct)

2.1 WHEN 本番環境（Vercel）でスプレッドシートの買主リストに新規レコードが追加される THEN 次回の定期同期タイミングにデータベースへ新規レコードが挿入される

2.2 WHEN 定期同期が実行される THEN スプレッドシートに存在してデータベースに存在しない買主レコードが検出され、データベースに挿入される

2.3 WHEN 本番環境で買主リストページを閲覧する THEN スプレッドシートに追加された新規買主が表示される（最大同期間隔の遅延は許容）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーがUIの「スプレッドシートから同期」ボタンを押す THEN 手動同期が引き続き正常に実行され、新規レコードが挿入される

3.2 WHEN 定期同期が実行される THEN 既存レコードの更新（`upsert` の update パス）が引き続き正常に動作する

3.3 WHEN 同期中に別の同期リクエストが来る THEN 重複同期が防止され、スキップされる（`isSyncInProgress()` チェックが維持される）

3.4 WHEN ローカル環境（非Vercel）でサーバーが起動する THEN 既存の `setInterval` による定期同期が引き続き正常に動作する

3.5 WHEN 売主リストの自動定期同期（`EnhancedPeriodicSyncManager`）が実行される THEN 買主リストの同期処理に影響を与えない（独立して動作する）
