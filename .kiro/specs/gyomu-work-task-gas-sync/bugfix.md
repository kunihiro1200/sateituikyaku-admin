# Bugfix Requirements Document

## Introduction

業務依頼（`work_tasks`）スプレッドシートのデータがDBに自動同期されていないバグを修正する。
具体的には、AA9195の「サイト登録締め日」などのフィールドがDBに反映されていない。

`EnhancedAutoSyncService.runFullSync()` の Phase 4 は `WorkTaskSyncService.syncAll()` を実際には呼び出しておらず、コメントのみで処理をスキップしている。そのため、業務依頼の同期は手動でAPIを叩かない限り実行されない。

修正方針は、物件リスト・買主リストと同様に **GASスクリプト（Google Apps Script）** を使って業務依頼スプレッドシートから Supabase DBへ直接 upsert する方式を採用する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `EnhancedAutoSyncService.runFullSync()` が定期実行される THEN Phase 4 は `WorkTaskSyncService.syncAll()` を呼び出さず、業務依頼データはDBに同期されない

1.2 WHEN 業務依頼スプレッドシートの「サイト登録締め日」などのフィールドが更新される THEN DBの `work_tasks` テーブルには反映されない

1.3 WHEN 手動で `POST /api/work-tasks/sync` を呼び出さない THEN 業務依頼データは永遠にDBに同期されない

### Expected Behavior (Correct)

2.1 WHEN 業務依頼スプレッドシートのデータが更新される THEN GASスクリプトが定期的（10分ごと）にSupabase DBへ upsert し、`work_tasks` テーブルに反映される

2.2 WHEN GASスクリプトが実行される THEN `work-task-column-mapping.json` に定義されたカラムマッピングに従い、スプレッドシートの全フィールドが正しくDBに書き込まれる

2.3 WHEN 物件番号が空の行がスプレッドシートに存在する THEN その行はスキップされ、エラーにならない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `POST /api/work-tasks/sync` が手動で呼び出される THEN 既存の `WorkTaskSyncService.syncAll()` は引き続き正常に動作する

3.2 WHEN `POST /api/work-tasks/sync/:propertyNumber` が呼び出される THEN 単一物件の同期は引き続き正常に動作する

3.3 WHEN `EnhancedAutoSyncService.runFullSync()` が実行される THEN Phase 1〜3（売主同期）、Phase 4.5〜4.8（物件リスト同期）、Phase 5（買主同期）は引き続き正常に動作する
