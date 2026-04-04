-- Add visit_time column to sellers table
-- 訪問時間（AS列）をデータベースに追加

ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS visit_time VARCHAR(20);

COMMENT ON COLUMN sellers.visit_time IS '訪問時間（例: 10:00、14:30）';
