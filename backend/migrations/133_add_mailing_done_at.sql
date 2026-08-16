-- 郵送済みにした日時を記録するカラムを追加
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mailing_done_at TIMESTAMPTZ;

COMMENT ON COLUMN sellers.mailing_done_at IS '郵送ステータスを「済」にした日時';
