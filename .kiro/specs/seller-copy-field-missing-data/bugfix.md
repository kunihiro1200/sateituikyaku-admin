# Bugfix Requirements Document

## Introduction

売主新規登録画面（NewSellerPage）の「売主コピー」フィールドで既存の売主を選択した際、名前（name）はコピーされるが、依頼者住所（address）・電話番号（phone_number）・メールアドレス（email）がコピーされない。

根本原因は、`/api/sellers/by-number/:sellerNumber` エンドポイントのレスポンスに `name` と `propertyAddress` しか含まれておらず、`address`・`phone_number`・`email` が返されていないことにある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主コピーフィールドで既存の売主番号を選択する THEN システムは名前フィールドのみをコピーし、依頼者住所・電話番号・メールアドレスのフィールドは空のままになる

1.2 WHEN `/api/sellers/by-number/:sellerNumber` エンドポイントが呼び出される THEN システムは `name` と `propertyAddress` のみを含むレスポンスを返し、`address`・`phone_number`・`email` を含まない

### Expected Behavior (Correct)

2.1 WHEN 売主コピーフィールドで既存の売主番号を選択する THEN システムは名前・依頼者住所・電話番号・メールアドレスの全フィールドをコピーする

2.2 WHEN `/api/sellers/by-number/:sellerNumber` エンドポイントが呼び出される THEN システムは `name`・`address`・`phone_number`・`email` を含むレスポンスを返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主コピーフィールドで売主を選択する THEN システムは引き続き名前フィールドを正しくコピーする

3.2 WHEN 売主コピーフィールドで売主を選択する THEN システムは引き続き `propertyAddress`（物件住所）をコピーしない（依頼者住所のみをコピーする）

3.3 WHEN 売主コピーフィールドに2文字未満の文字列を入力する THEN システムは引き続き検索を実行しない

3.4 WHEN 売主コピーフィールドで存在しない売主番号を選択しようとする THEN システムは引き続きエラーメッセージを表示する

3.5 WHEN 買主コピーフィールドで既存の買主を選択する THEN システムは引き続き買主の名前・電話番号・メールアドレスを正しくコピーする
