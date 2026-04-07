-- 他社物件新着配信機能用のインデックス作成
-- 作成日: 2026-04-07

-- desired_area カラムにGINインデックス（部分一致検索の高速化）
CREATE INDEX IF NOT EXISTS idx_buyers_desired_area_gin 
ON buyers USING gin(desired_area gin_trgm_ops);

-- desired_property_type カラムにGINインデックス
CREATE INDEX IF NOT EXISTS idx_buyers_desired_property_type_gin 
ON buyers USING gin(desired_property_type gin_trgm_ops);

-- deleted_at カラムに部分インデックス（削除済み除外の高速化）
CREATE INDEX IF NOT EXISTS idx_buyers_deleted_at 
ON buyers(deleted_at) WHERE deleted_at IS NULL;
