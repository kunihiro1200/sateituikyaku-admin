-- 復元フラグと復元日時カラムを追加

-- is_restoredカラムを追加（デフォルト: false）
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS is_restored BOOLEAN DEFAULT false;

-- restored_atカラムを追加（復元日時）
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

-- コメント追加
COMMENT ON COLUMN sellers.is_restored IS '復元されたレコードかどうか（復元カテゴリ用）';
COMMENT ON COLUMN sellers.restored_at IS '復元日時';

-- インデックス追加（復元カテゴリのフィルタリング高速化）
CREATE INDEX IF NOT EXISTS idx_sellers_is_restored ON sellers(is_restored) WHERE is_restored = true;
