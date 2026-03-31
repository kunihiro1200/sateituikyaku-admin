# バグフィックス要件ドキュメント

## Introduction

AA13175の「ID」フィールド（`inquiry_id`）がスプレッドシートのD列に`CO2511-94507`と入力されており、データベースにも正しく保存されているにもかかわらず、通話モードページの除外申請セクションで「－」と表示される問題を修正します。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN AA13175の売主データを通話モードページで表示する THEN 「ID」フィールドが「－」と表示される

1.2 WHEN スプレッドシートD列に`inquiry_id`の値（`CO2511-94507`）が入力されている THEN データベースには正しく保存されているが、通話モードページでは表示されない

1.3 WHEN `SellerService.decryptSeller()`が`inquiryId: seller.inquiry_id`を含めて返す THEN フロントエンドで`seller.inquiryId`が`undefined`または`null`になっている

### Expected Behavior (Correct)

2.1 WHEN AA13175の売主データを通話モードページで表示する THEN 「ID」フィールドに`CO2511-94507`が表示される

2.2 WHEN スプレッドシートD列に`inquiry_id`の値が入力されている THEN データベースに保存され、通話モードページでも正しく表示される

2.3 WHEN `SellerService.decryptSeller()`が`inquiryId: seller.inquiry_id`を返す THEN フロントエンドで`seller.inquiryId`が正しく受け取られ、表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `inquiry_id`が空の売主データを表示する THEN 「ID」フィールドは引き続き「－」と表示される

3.2 WHEN サイトが「す」または「L」以外の売主データを表示する THEN 「ID」フィールドは引き続き表示されない

3.3 WHEN 他のフィールド（名前、電話番号、反響詳細日時など）を表示する THEN 引き続き正しく表示される
