-- 郵送済み操作者を記録するカラムを追加
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mailing_done_by TEXT;

COMMENT ON COLUMN sellers.mailing_done_by IS '郵送ステータスを「済」にした操作者のイニシャル';
