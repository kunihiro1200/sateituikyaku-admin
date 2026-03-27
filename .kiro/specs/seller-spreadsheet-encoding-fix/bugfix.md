# Bugfix Requirements Document

## Introduction

売主リストでフィールドを編集・保存すると、DB→スプシの即時同期処理が走る。
その際、`sellers` テーブルの暗号化フィールド（`name`・`phone_number`・`email`）が
復号されないまま AES-256-GCM の Base64 暗号文（例: `acLCZeMGRDaf/DM8rFZBircz+...`）として
スプレッドシートに書き込まれてしまう。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `SpreadsheetSyncService.syncToSpreadsheet()` 内で Supabase から取得した暗号化済みの `name` をそのままスプレッドシートの「名前」列に書き込む

1.2 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `SpreadsheetSyncService.syncToSpreadsheet()` 内で Supabase から取得した暗号化済みの `phone_number` をそのままスプレッドシートの「電話番号」列に書き込む

1.3 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `SpreadsheetSyncService.syncToSpreadsheet()` 内で Supabase から取得した暗号化済みの `email` をそのままスプレッドシートの「メールアドレス」列に書き込む

1.4 WHEN バッチ同期（`syncBatchToSpreadsheet()`）が実行される THEN システムは複数売主の暗号化済みフィールドをそのままスプレッドシートに書き込む

### Expected Behavior (Correct)

2.1 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `name` を `decrypt()` で復号してからスプレッドシートの「名前」列に書き込む SHALL

2.2 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `phone_number` を `decrypt()` で復号してからスプレッドシートの「電話番号」列に書き込む SHALL

2.3 WHEN ユーザーが売主リストでフィールドを編集して保存する THEN システムは `email` を `decrypt()` で復号してからスプレッドシートの「メールアドレス」列に書き込む SHALL

2.4 WHEN バッチ同期（`syncBatchToSpreadsheet()`）が実行される THEN システムは複数売主の暗号化フィールドを全て復号してからスプレッドシートに書き込む SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主の非暗号化フィールド（`status`・`next_call_date`・`visit_date` 等）が更新される THEN システムは SHALL CONTINUE TO それらのフィールドを変更なくスプレッドシートに書き込む

3.2 WHEN 売主番号（`seller_number`）でスプレッドシートの既存行を検索する THEN システムは SHALL CONTINUE TO 正しい行を特定して部分更新する

3.3 WHEN スプレッドシートに該当売主が存在しない場合 THEN システムは SHALL CONTINUE TO 新規行を追加する

3.4 WHEN `email` が `null` または空文字の場合 THEN システムは SHALL CONTINUE TO スプレッドシートの「メールアドレス」列を空のまま書き込む（クラッシュしない）

3.5 WHEN `SellerService.updateSeller()` が呼ばれる THEN システムは SHALL CONTINUE TO 復号済みの売主データを API レスポンスとして返す（既存の `decryptSeller()` の動作を変えない）
