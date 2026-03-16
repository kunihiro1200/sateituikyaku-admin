-- buyers テーブルに db_updated_at カラムを追加
-- 手動更新時にセットされ、スプレッドシート同期による上書きを防ぐために使用

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN buyers.db_updated_at IS '手動更新日時（スプレッドシート同期による上書き防止用）';
