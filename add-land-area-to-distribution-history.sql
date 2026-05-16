-- distribution_history テーブルに land_area カラムを追加
ALTER TABLE distribution_history ADD COLUMN IF NOT EXISTS land_area TEXT;

-- 土地面積での重複チェック用インデックス
CREATE INDEX IF NOT EXISTS idx_distribution_history_address_land_area
  ON distribution_history (property_address, land_area);
