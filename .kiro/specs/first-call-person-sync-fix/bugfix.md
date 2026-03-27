# Bugfix Requirements Document

## Introduction

売主の通話モードページ（CallModePage）に表示される「1番電話」フィールド（`first_call_person`）が、スプレッドシートとデータベース間で正しく同期されていない。

具体的には以下の2つの問題が存在する：
1. `column-mapping.json` のスプレッドシートカラム名が `"一番TEL"` になっているが、実際のスプレッドシートのカラム名は `"1番電話"` である
2. `EnhancedAutoSyncService.ts` の `syncSingleSeller` / `updateSingleSeller` メソッドに `first_call_person` の同期処理が含まれていない

この結果、スプレッドシートで「1番電話」を更新してもDBに反映されず、またDBで更新してもスプレッドシートに反映されない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの「1番電話」カラムに値が入力されている THEN システムはその値をデータベースの `first_call_person` カラムに同期しない

1.2 WHEN `EnhancedAutoSyncService` が売主の新規追加同期（`syncSingleSeller`）を実行する THEN システムは `first_call_person` フィールドを無視してDBに保存しない

1.3 WHEN `EnhancedAutoSyncService` が売主の更新同期（`updateSingleSeller`）を実行する THEN システムは `first_call_person` フィールドを無視してDBを更新しない

1.4 WHEN `column-mapping.json` の `spreadsheetToDatabase` セクションを参照する THEN システムはスプレッドシートカラム名 `"一番TEL"` でマッピングを試みるが、実際のカラム名 `"1番電話"` と一致しないため同期が機能しない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの「1番電話」カラムに値が入力されている THEN システムはその値をデータベースの `first_call_person` カラムに正しく同期する SHALL

2.2 WHEN `EnhancedAutoSyncService` が売主の新規追加同期（`syncSingleSeller`）を実行する THEN システムはスプレッドシートの `row['1番電話']` を読み取り `first_call_person` としてDBに保存する SHALL

2.3 WHEN `EnhancedAutoSyncService` が売主の更新同期（`updateSingleSeller`）を実行する THEN システムはスプレッドシートの `row['1番電話']` を読み取り `first_call_person` としてDBを更新する SHALL

2.4 WHEN `column-mapping.json` の `spreadsheetToDatabase` セクションを参照する THEN システムはスプレッドシートカラム名 `"1番電話"` を `first_call_person` に正しくマッピングする SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 通話モードページでユーザーが「1番電話」フィールドを編集して保存する THEN システムはその値をDBに保存し、スプレッドシートに即時同期する SHALL CONTINUE TO

3.2 WHEN `SellerService.supabase.ts` の `decryptSeller` メソッドが呼ばれる THEN システムは `first_call_person` を `firstCallPerson` としてAPIレスポンスに含める SHALL CONTINUE TO

3.3 WHEN スプレッドシートの「電話担当（任意）」「連絡取りやすい日、時間帯」「連絡方法」カラムが更新される THEN システムはそれぞれ `phone_contact_person`、`preferred_contact_time`、`contact_method` として正しく同期する SHALL CONTINUE TO

3.4 WHEN `column-mapping.json` の `databaseToSpreadsheet` セクションで `first_call_person` が `"一番TEL"` にマッピングされている THEN システムはDBからスプレッドシートへの書き戻し時にそのマッピングを使用する SHALL CONTINUE TO
