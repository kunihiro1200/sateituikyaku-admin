# Bugfix Requirements Document

## Introduction

売主リストの通話モードページにおいて、「土地面積（当社調べ）」フィールドに値を入力して保存すると、データベースエラーが発生し保存できない問題を修正します。

エラーメッセージによると、`properties`テーブルの`address`カラムが見つからないというスキーマエラーが発生しています。ステアリングドキュメント（`seller-table-column-definition.md`）によると、`properties`テーブルには`address`カラムは存在せず、`property_address`カラムを使用する必要があります。

この問題により、ユーザーは物件情報セクションで土地面積（当社調べ）を保存できず、業務に支障が出ています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページの物件情報セクションで「土地面積（当社調べ）」フィールドに値（例: 100）を入力して保存ボタンをクリック THEN システムはエラー「Could not find the 'address' column of 'properties' in the schema cache」を返し、保存に失敗する

1.2 WHEN 土地面積（当社調べ）の保存処理が実行される THEN Geocoding APIが「REQUEST DENIED」エラーで失敗する

1.3 WHEN 土地面積（当社調べ）の保存処理が実行される THEN サーバーが500エラーを返す

### Expected Behavior (Correct)

2.1 WHEN 通話モードページの物件情報セクションで「土地面積（当社調べ）」フィールドに値（例: 100）を入力して保存ボタンをクリック THEN システムは正しいカラム名（`property_address`）を使用してデータベースに保存し、成功メッセージを表示する

2.2 WHEN 土地面積（当社調べ）の保存処理が実行される THEN Geocoding APIを呼び出す必要がある場合は、正しい住所カラム（`property_address`）を参照して実行する

2.3 WHEN 土地面積（当社調べ）の保存処理が実行される THEN サーバーは200ステータスコードを返し、保存が成功する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 通話モードページの他のフィールド（土地面積（m²）、建物面積（m²）、建物面積（当社調べ）（m²）など）を編集して保存する THEN システムは引き続き正常に保存される

3.2 WHEN 売主詳細ページや他のページで物件情報を編集して保存する THEN システムは引き続き正常に保存される

3.3 WHEN `property_address`カラムを正しく使用している既存の機能（物件住所の表示、検索など）を実行する THEN システムは引き続き正常に動作する
