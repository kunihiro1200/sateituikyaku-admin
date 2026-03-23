# Bugfix Requirements Document

## Introduction

売主リストのスプレッドシート→DB同期において、「訪問事前通知メール担当」フィールド（CV列、DBカラム: `visit_reminder_assignee`）が定期同期（10分トリガー）で同期されていないバグ。

AA13677を含む複数の売主で、スプレッドシートのCV列に値が入っているにもかかわらず、DBの`visit_reminder_assignee`が空のままになっている。

**根本原因**: GASの`syncUpdatesToSupabase_`関数（Phase 2更新同期）に`visit_reminder_assignee`フィールドが含まれていない。また`fetchAllSellersFromSupabase_`でDBから取得するフィールドリストにも`visit_reminder_assignee`が含まれていないため、差分比較すら行われていない。

バックエンドコード（`EnhancedAutoSyncService.ts`、`SellerService.supabase.ts`、`column-mapping.json`）は既に正しく実装済みであり、修正が必要なのはGASのみ。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN GASの10分トリガーで`syncSellerList`が実行される THEN `syncUpdatesToSupabase_`関数は`visit_reminder_assignee`フィールドを同期対象に含めないため、スプレッドシートのCV列の値がDBに反映されない

1.2 WHEN `fetchAllSellersFromSupabase_`がDBから売主データを取得する THEN `visit_reminder_assignee`カラムが取得フィールドリストに含まれていないため、差分比較が行われない

### Expected Behavior (Correct)

2.1 WHEN GASの10分トリガーで`syncSellerList`が実行される THEN `syncUpdatesToSupabase_`関数はスプレッドシートのCV列「訪問事前通知メール担当」の値をDBの`visit_reminder_assignee`カラムに同期SHALL

2.2 WHEN `fetchAllSellersFromSupabase_`がDBから売主データを取得する THEN `visit_reminder_assignee`カラムを含むフィールドリストでデータを取得し、差分比較に使用SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN GASの10分トリガーで`syncSellerList`が実行される THEN 既存の同期フィールド（`status`, `next_call_date`, `visit_assignee`, `unreachable_status`, `comments`, `phone_contact_person`, `preferred_contact_time`, `contact_method`, `contract_year_month`, `current_status`, `pinrich_status`）は引き続き正常に同期SHALL CONTINUE TO

3.2 WHEN スプレッドシートのCV列が空欄の場合 THEN DBの`visit_reminder_assignee`を`null`に更新SHALL CONTINUE TO（既存の`syncVisitReminderAssignee`関数と同じ挙動）
