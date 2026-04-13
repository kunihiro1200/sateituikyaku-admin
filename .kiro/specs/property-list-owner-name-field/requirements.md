# 要件ドキュメント

## はじめに

物件リスト詳細画面において、「売主氏名」フィールドの値取得ロジックを変更する。
現在はスプレッドシートの O列（`名前(売主）`）のみを参照しているが、BL列（`●所有者情報`）を優先的に参照し、空欄の場合のみ O列にフォールバックするロジックに変更する。

対象フィールドは以下の2箇所：
1. 物件情報セクションの「売主氏名」フィールド
2. 売り主・買主情報セクションの「売主」フィールド

### 背景

スプレッドシートには売主氏名を格納するカラムが2つ存在する：
- **O列**（カラム名：`名前(売主）`）：従来の売主氏名カラム（括弧が半角 `(` と全角 `）` 混在）
- **BL列**（カラム名：`●所有者情報`）：所有者情報カラム（より正確な情報が入力される）

BL列に値がある場合はそちらを優先することで、より正確な売主氏名を表示できる。

---

## 用語集

- **PropertyListingService**: 物件リスト（`property_listings` テーブル）のCRUD操作を担当するサービス（`backend/src/services/PropertyListingService.ts`）
- **PropertyListingSyncService**: スプレッドシートと `property_listings` テーブルの同期を担当するサービス（`backend/src/services/PropertyListingSyncService.ts`）
- **PropertyListingColumnMapper**: スプレッドシートのカラム名とDBカラム名のマッピングを管理するサービス（`backend/src/services/PropertyListingColumnMapper.ts`）
- **property_listings**: 物件リストを格納するSupabaseテーブル
- **seller_name**: `property_listings` テーブルの売主氏名カラム
- **owner_info**: `property_listings` テーブルの所有者情報カラム（BL列に対応）
- **名前(売主）**: スプレッドシートO列のカラム名（括弧が半角 `(` と全角 `）` 混在）
- **●所有者情報**: スプレッドシートBL列のカラム名
- **フォールバック**: 優先値が空欄の場合に代替値を使用する処理

---

## 要件

### 要件1：スプレッドシート同期時の seller_name 取得ロジック変更

**ユーザーストーリー：** 管理者として、物件リスト詳細画面に正確な売主氏名を表示したい。そのために、BL列（`●所有者情報`）を優先し、空欄の場合はO列（`名前(売主）`）にフォールバックする取得ロジックを実装してほしい。

#### 受け入れ基準

1. WHEN スプレッドシートから物件リストを同期する際、THE PropertyListingSyncService SHALL BL列（`●所有者情報`）の値を `seller_name` として優先的に使用する
2. WHEN BL列（`●所有者情報`）が空欄の場合、THE PropertyListingSyncService SHALL O列（`名前(売主）`）の値を `seller_name` として使用する
3. WHEN BL列（`●所有者情報`）とO列（`名前(売主）`）の両方が空欄の場合、THE PropertyListingSyncService SHALL `seller_name` を `null` として保存する
4. THE PropertyListingColumnMapper SHALL `●所有者情報` カラムを `owner_info` DBカラムにマッピングする（`seller_name` への直接マッピングは削除する）
5. THE PropertyListingColumnMapper SHALL `名前(売主）` カラムを `seller_name` DBカラムにマッピングする（括弧の混在に注意：半角 `(` と全角 `）`）

### 要件2：物件リスト詳細画面の売主氏名表示

**ユーザーストーリー：** 管理者として、物件リスト詳細画面の「物件情報セクション」と「売り主・買主情報セクション」に正確な売主氏名を表示したい。

#### 受け入れ基準

1. WHEN 物件リスト詳細画面を表示する際、THE PropertyListingService SHALL `seller_name` フィールドの値を返す
2. WHEN `seller_name` が `null` または空欄の場合、THE PropertyListingService SHALL 空文字列または `null` を返す（エラーにしない）
3. THE System SHALL 物件情報セクションの「売主氏名」フィールドに `seller_name` の値を表示する
4. THE System SHALL 売り主・買主情報セクションの「売主」フィールドに `seller_name` の値を表示する

### 要件3：カラムマッピング設定の整合性

**ユーザーストーリー：** 開発者として、スプレッドシートのカラムとDBカラムのマッピングが正確に管理されていることを確認したい。

#### 受け入れ基準

1. THE PropertyListingColumnMapper SHALL `property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションで `●所有者情報` を `owner_info` にマッピングする
2. THE PropertyListingColumnMapper SHALL `property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションで `名前(売主）` を `seller_name` にマッピングする（括弧の混在：半角 `(` と全角 `）`）
3. IF `●所有者情報` カラムが `seller_name` に重複マッピングされている場合、THEN THE System SHALL 重複マッピングを解消し、`owner_info` への単一マッピングに修正する
4. WHEN スプレッドシートの同期処理が実行される際、THE PropertyListingSyncService SHALL `owner_info` の値が存在する場合は `seller_name` に優先的にコピーし、存在しない場合は `名前(売主）` の値を `seller_name` に使用する

### 要件4：既存データの後方互換性

**ユーザーストーリー：** 管理者として、ロジック変更後も既存の物件データが正しく表示されることを確認したい。

#### 受け入れ基準

1. WHEN 同期処理が実行される際、THE PropertyListingSyncService SHALL 既存の `seller_name` データを上書きする前に新しいロジックで値を計算する
2. WHEN BL列（`●所有者情報`）に値が存在する物件の場合、THE System SHALL その値を `seller_name` として表示する
3. WHEN BL列（`●所有者情報`）が空欄でO列（`名前(売主）`）に値が存在する物件の場合、THE System SHALL O列の値を `seller_name` として表示する
4. IF 同期処理中にエラーが発生した場合、THEN THE PropertyListingSyncService SHALL エラーをログに記録し、当該物件の処理をスキップして他の物件の処理を継続する
