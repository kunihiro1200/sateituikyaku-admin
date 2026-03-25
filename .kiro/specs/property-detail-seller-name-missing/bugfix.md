# バグ修正要件ドキュメント

## はじめに

物件詳細画面において、ほとんどの売主氏名が表示されないバグを修正する。

`property_listings.seller_name` カラムに、`sellers.name`（暗号化済み）がそのまま保存されているレコードが多数存在することが原因と考えられる。`PropertyListingSyncService.mapSellerToPropertyListing()` が過去に復号処理を行わずに `seller_name` をコピーしていたため、暗号文がそのまま保存された。

現在のコードでは `decrypt(seller.name)` を使って復号してから保存するよう修正済みだが、過去に作成された `property_listings` レコードには暗号化文字列がそのまま残っている。これらの既存レコードを修正する必要がある。

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN `property_listings.seller_name` に暗号化文字列（Base64エンコードされた暗号文）が保存されている場合 THEN 物件詳細画面は暗号化文字列をそのまま表示する

1.2 WHEN `property_listings.seller_name` に暗号化文字列が保存されている場合 THEN 物件詳細画面の売主氏名欄は意味不明な文字列（例: `acLCZeMGRDaf/DM8rFZBircz+...`）または空欄として表示される

1.3 WHEN `PropertyListingSyncService.syncFromSeller()` が過去に復号処理なしで実行された場合 THEN `property_listings.seller_name` に暗号化文字列が保存される

### 期待される動作（正常）

2.1 WHEN `property_listings.seller_name` に暗号化文字列が保存されている場合 THEN システムは対応する `sellers.name` を復号して `property_listings.seller_name` を正しい売主氏名で上書きする SHALL

2.2 WHEN 修正スクリプトが実行された場合 THEN システムは `property_listings` テーブル内の全暗号化 `seller_name` を復号済みの正しい売主氏名に更新する SHALL

2.3 WHEN `PropertyListingSyncService.mapSellerToPropertyListing()` が実行される場合 THEN システムは `decrypt(seller.name)` を使って復号した値を `seller_name` に保存する SHALL（現在のコードは既に対応済み）

### 変更されない動作（リグレッション防止）

3.1 WHEN `property_listings.seller_name` にすでに平文の売主氏名が保存されている場合 THEN システムは CONTINUE TO その値を変更せずに保持する

3.2 WHEN `property_listings.seller_name` が NULL または空文字の場合 THEN システムは CONTINUE TO その値を NULL または空文字のまま保持する

3.3 WHEN 物件詳細画面が正しい売主氏名を表示している場合 THEN システムは CONTINUE TO その表示を維持する

3.4 WHEN `sellers.name` が NULL の場合 THEN システムは CONTINUE TO `property_listings.seller_name` を NULL として保存する
