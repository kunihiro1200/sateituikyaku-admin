-- 随行者カラムを buyers テーブルに追加
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS viewing_companion TEXT;

COMMENT ON COLUMN buyers.viewing_companion IS '随行者';
