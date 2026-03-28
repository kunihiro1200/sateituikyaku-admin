# Bugfix Requirements Document

## Introduction

`sellers` テーブルのデータを更新・作成すると、DB→スプレッドシート同期の際に、`address`（依頼者住所）カラムが暗号化された文字列のままスプレッドシートのD列に書き込まれてしまうバグ。

`address` は暗号化対象外フィールドであるべきだが、`SellerService` の `createSeller()` および `updateSeller()` で誤って `encrypt(data.address)` が呼ばれてDBに暗号化保存されている。さらに `SpreadsheetSyncService.decryptSellerFields()` では `name`・`phone_number`・`email` の3フィールドしか復号していないため、`address` が暗号化文字列のままスプレッドシートに書き込まれる。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `sellers` テーブルのレコードが作成または更新される THEN システムは `address` フィールドを `encrypt()` で暗号化してDBに保存する

1.2 WHEN DB→スプレッドシート同期が実行される THEN システムは `address` フィールドを復号せずに暗号化文字列（例: `D9UAbI6q6UUbe01lbdvnvj98MBMETZAQQpFipJN3vZKYoAPvLboebOhCHf8iOrGUkO1L3MH47BlMTKCiS6J1qB8Api7Y78QCwS4K0IURhAvT3JmUAMIGKEcqT8xWROOMkdS/Ie2Zylh5swyY9bMPt+fYAmyQqyvsXJdQdYnz37q5CQ==`）のままスプレッドシートのD列に書き込む

### Expected Behavior (Correct)

2.1 WHEN `sellers` テーブルのレコードが作成または更新される THEN システムは `address` フィールドを暗号化せずに平文のままDBに保存する SHALL

2.2 WHEN DB→スプレッドシート同期が実行される THEN システムは `address` フィールドの平文をそのままスプレッドシートのD列に書き込む SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `sellers` テーブルのレコードが作成または更新される THEN システムは `name`（名前）フィールドを引き続き暗号化してDBに保存する SHALL CONTINUE TO

3.2 WHEN `sellers` テーブルのレコードが作成または更新される THEN システムは `phone_number`（電話番号）フィールドを引き続き暗号化してDBに保存する SHALL CONTINUE TO

3.3 WHEN `sellers` テーブルのレコードが作成または更新される THEN システムは `email`（メールアドレス）フィールドを引き続き暗号化してDBに保存する SHALL CONTINUE TO

3.4 WHEN DB→スプレッドシート同期が実行される THEN システムは `name`・`phone_number`・`email` の3フィールドを引き続き復号してからスプレッドシートに書き込む SHALL CONTINUE TO
