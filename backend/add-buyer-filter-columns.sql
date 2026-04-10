-- property_listings テーブルに買主フィルター設定カラムを追加
-- Supabase の SQL エディタで実行してください

ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS buyer_filter_pet TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_parking TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_onsen TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_filter_floor TEXT DEFAULT NULL;

-- 確認クエリ
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'property_listings'
  AND column_name IN ('buyer_filter_pet', 'buyer_filter_parking', 'buyer_filter_onsen', 'buyer_filter_floor');
