-- 気づき（内覧実行者）と気づき（随行者）カラムを buyers テーブルに追加
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS viewing_insight_executor TEXT,
  ADD COLUMN IF NOT EXISTS viewing_insight_companion TEXT;

COMMENT ON COLUMN buyers.viewing_insight_executor IS '気づき（内覧実行者）';
COMMENT ON COLUMN buyers.viewing_insight_companion IS '気づき（随行者）';
