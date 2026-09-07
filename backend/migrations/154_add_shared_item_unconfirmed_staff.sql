-- 共有アイテムのスタッフ未確認管理テーブル
-- スプシの「共有できていない」「確認日」カラムに依存せず、DBだけで管理する
CREATE TABLE IF NOT EXISTS shared_item_unconfirmed_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_item_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shared_item_id, staff_name)
);

CREATE INDEX IF NOT EXISTS idx_shared_item_unconfirmed_staff_item_id
  ON shared_item_unconfirmed_staff (shared_item_id);

CREATE INDEX IF NOT EXISTS idx_shared_item_unconfirmed_staff_name
  ON shared_item_unconfirmed_staff (staff_name);
