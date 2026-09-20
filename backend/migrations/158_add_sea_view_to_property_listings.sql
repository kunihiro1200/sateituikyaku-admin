-- 物件リストに「海」カラムを追加（スプレッドシートDR列）
ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS sea_view VARCHAR(20);
