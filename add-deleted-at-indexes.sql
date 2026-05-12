-- deleted_atカラムにインデックスを追加してパフォーマンスを改善

-- sellersテーブル
CREATE INDEX IF NOT EXISTS idx_sellers_deleted_at ON sellers(deleted_at) WHERE deleted_at IS NULL;

-- buyersテーブル
CREATE INDEX IF NOT EXISTS idx_buyers_deleted_at ON buyers(deleted_at) WHERE deleted_at IS NULL;

-- ANALYZE to update statistics
ANALYZE sellers;
ANALYZE buyers;
