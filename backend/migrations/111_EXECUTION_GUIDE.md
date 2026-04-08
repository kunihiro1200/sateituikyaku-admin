# マイグレーション111実行ガイド

## 概要

このマイグレーションは、`buyers`テーブルに地理座標カラム（`desired_area_lat`、`desired_area_lng`）とインデックスを追加します。

## 実行方法

### 手順1: Supabaseダッシュボードにアクセス

1. https://supabase.com/dashboard にアクセス
2. プロジェクト `krxhrbtlgfjzsseegaqq` を選択
3. 左メニューから「SQL Editor」を選択

### 手順2: SQLを実行

以下のSQLをコピーして、SQL Editorに貼り付けて実行してください：

```sql
-- Migration: Add coordinates to buyers table for radius search
-- Description: Add latitude and longitude columns for desired area

-- Add columns
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS desired_area_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS desired_area_lng DOUBLE PRECISION;

-- Add index for efficient radius search
CREATE INDEX IF NOT EXISTS idx_buyers_desired_area_coordinates 
ON buyers(desired_area_lat, desired_area_lng) 
WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;

-- Add comments
COMMENT ON COLUMN buyers.desired_area_lat IS '希望エリアの緯度（半径検索用）';
COMMENT ON COLUMN buyers.desired_area_lng IS '希望エリアの経度（半径検索用）';
```

### 手順3: 実行結果を確認

実行が成功すると、以下のメッセージが表示されます：

```
Success. No rows returned
```

### 手順4: カラムが追加されたことを確認

以下のSQLを実行して、カラムが正しく追加されたことを確認してください：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'buyers' 
AND column_name IN ('desired_area_lat', 'desired_area_lng');
```

期待される結果：

```
column_name         | data_type
--------------------+------------------
desired_area_lat    | double precision
desired_area_lng    | double precision
```

### 手順5: インデックスが作成されたことを確認

以下のSQLを実行して、インデックスが正しく作成されたことを確認してください：

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'buyers' 
AND indexname = 'idx_buyers_desired_area_coordinates';
```

期待される結果：

```
indexname                              | indexdef
---------------------------------------+--------------------------------------------------
idx_buyers_desired_area_coordinates    | CREATE INDEX idx_buyers_desired_area_coordinates...
```

## トラブルシューティング

### エラー: column "desired_area_lat" already exists

このエラーが表示された場合、カラムは既に存在しています。`IF NOT EXISTS`句があるため、通常はこのエラーは発生しませんが、もし発生した場合は無視して次のステップに進んでください。

### エラー: relation "idx_buyers_desired_area_coordinates" already exists

このエラーが表示された場合、インデックスは既に存在しています。`IF NOT EXISTS`句があるため、通常はこのエラーは発生しませんが、もし発生した場合は無視して次のステップに進んでください。

## 完了

マイグレーションが正常に完了しました。次のタスクに進んでください。
