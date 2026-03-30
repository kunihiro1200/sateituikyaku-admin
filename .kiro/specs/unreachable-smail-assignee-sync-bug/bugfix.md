# Bugfix Requirements Document

## Introduction

売主リストにおいて「不通時Sメール担当」フィールド（スプレッドシートカラム名: `不通時Sメール担当`、DBカラム名: `unreachable_sms_assignee`）が、スプレッドシートに値が入力されているにもかかわらずDBに同期されていないバグ。

確認された売主: AA13284

調査の結果、`column-mapping.json` には `"不通時Sメール担当": "unreachable_sms_assignee"` のマッピングが正しく定義されており、`SellerService.supabase.ts` の `decryptSeller` メソッドにも `unreachableSmsAssignee: seller.unreachable_sms_assignee` が含まれている。しかし、`EnhancedAutoSyncService.ts` の `syncSingleSeller` および `updateSingleSeller` メソッドに「不通時Sメール担当」の同期処理が実装されていないことが根本原因である。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの「不通時Sメール担当」列に値が入力されている売主に対してGASの定期同期（`syncSellerList`）が実行される THEN システムは `unreachable_sms_assignee` カラムをDBに保存しない（値がnullのまま）

1.2 WHEN `EnhancedAutoSyncService.updateSingleSeller()` が呼び出される THEN システムはスプレッドシートの `row['不通時Sメール担当']` を読み取らず、`updateData` に `unreachable_sms_assignee` を含めない

1.3 WHEN `EnhancedAutoSyncService.syncSingleSeller()` が呼び出される THEN システムはスプレッドシートの `row['不通時Sメール担当']` を読み取らず、`encryptedData` に `unreachable_sms_assignee` を含めない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの「不通時Sメール担当」列に値が入力されている売主に対してGASの定期同期が実行される THEN システムは `unreachable_sms_assignee` カラムにその値をDBに保存する

2.2 WHEN `EnhancedAutoSyncService.updateSingleSeller()` が呼び出される THEN システムは `row['不通時Sメール担当']` を読み取り、値が存在する場合は `updateData.unreachable_sms_assignee` に設定する

2.3 WHEN `EnhancedAutoSyncService.syncSingleSeller()` が呼び出される THEN システムは `row['不通時Sメール担当']` を読み取り、値が存在する場合は `encryptedData.unreachable_sms_assignee` に設定する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「不通時Sメール担当」以外のフィールド（`status`、`next_call_date`、`comments` 等）が同期される THEN システムは CONTINUE TO それらのフィールドを従来通り正しくDBに保存する

3.2 WHEN スプレッドシートの「不通時Sメール担当」列が空欄の売主が同期される THEN システムは CONTINUE TO DBの既存値を変更しない（空欄でDBの値を上書きしない）

3.3 WHEN `SellerService.decryptSeller()` が呼び出される THEN システムは CONTINUE TO `unreachableSmsAssignee: seller.unreachable_sms_assignee` をAPIレスポンスに含める

3.4 WHEN `SellerService.updateSeller()` でフロントエンドから `unreachableSmsAssignee` が更新される THEN システムは CONTINUE TO `unreachable_sms_assignee` をDBに保存する
