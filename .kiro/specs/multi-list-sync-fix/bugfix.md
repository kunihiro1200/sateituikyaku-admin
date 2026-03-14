# Bugfix Requirements Document

## Introduction

物件リスト・業務依頼・共有の3つのリストについて、スプレッドシートからデータベースへの自動定期同期が実装されていないバグ。

売主リストには `EnhancedPeriodicSyncManager` による自動定期同期（10分ごと）が、買主リストには `BuyerSyncService` の定期実行スケジューラーが `backend/src/index.ts` の `startServer()` に登録されている。しかし、物件リスト（`PropertyListingSyncService`）・業務依頼（`WorkTaskSyncService`）・共有（`SharedItemsService`）の3つには同等の仕組みが存在しない。そのため、スプレッドシートで更新されたデータがデータベースに反映されず、ブラウザに古い情報が表示され続ける。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サーバーが起動する THEN 物件リストの自動定期同期が開始されない（`PropertyListingSyncService` の定期実行が `startServer()` にスケジュールされていない）

1.2 WHEN サーバーが起動する THEN 業務依頼の自動定期同期が開始されない（`WorkTaskSyncService` の定期実行が `startServer()` にスケジュールされていない）

1.3 WHEN サーバーが起動する THEN 共有の自動定期同期が開始されない（`SharedItemsService` はスプレッドシートを直接読み取るのみで、データベースへの定期同期の仕組みがない）

1.4 WHEN スプレッドシートの物件リストデータが更新される THEN データベースへの反映が行われない（手動同期またはUIボタン操作をしない限り）

1.5 WHEN スプレッドシートの業務依頼データが更新される THEN データベースへの反映が行われない（手動同期またはUIボタン操作をしない限り）

### Expected Behavior (Correct)

2.1 WHEN サーバーが起動する THEN 物件リストの自動定期同期が開始され、売主リスト・買主リストと同様に定期的にスプレッドシートからデータベースへ同期が実行される

2.2 WHEN サーバーが起動する THEN 業務依頼の自動定期同期が開始され、定期的にスプレッドシートからデータベースへ同期が実行される

2.3 WHEN スプレッドシートの物件リストデータが更新される THEN 次回の定期同期タイミング（最大10分以内）にデータベースへ自動的に反映される

2.4 WHEN スプレッドシートの業務依頼データが更新される THEN 次回の定期同期タイミング（最大10分以内）にデータベースへ自動的に反映される

2.5 WHEN 同期中に別の同期リクエストが来る THEN 重複同期が防止され、スキップされる

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーがUIの手動同期ボタンを押す THEN 物件リスト・業務依頼それぞれの手動同期が引き続き正常に実行される

3.2 WHEN 売主リストの自動定期同期（`EnhancedPeriodicSyncManager`）が実行される THEN 物件リスト・業務依頼・共有の同期処理に影響を与えない（独立して動作する）

3.3 WHEN 買主リストの自動定期同期（`BuyerSyncService`）が実行される THEN 物件リスト・業務依頼・共有の同期処理に影響を与えない（独立して動作する）

3.4 WHEN サーバーが起動する THEN 売主リストの自動定期同期（`EnhancedPeriodicSyncManager`）が引き続き正常に起動する

3.5 WHEN サーバーが起動する THEN 買主リストの自動定期同期（`BuyerSyncService`）が引き続き正常に起動する

3.6 WHEN 共有ページがスプレッドシートを直接読み取る THEN 既存の読み取り動作が引き続き正常に機能する
