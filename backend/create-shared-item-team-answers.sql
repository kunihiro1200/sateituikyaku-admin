-- shared_item_team_answers テーブル
-- 「契約率チーム」「物件数チーム」専用の「問い」「各担当者回答」「まとめ」を保存
-- スプレッドシートには保存しない、DB専用

CREATE TABLE IF NOT EXISTS shared_item_team_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_item_id TEXT NOT NULL,       -- SharedItemsServiceのID（スプシのA列ID）
  question TEXT,                       -- 「問い」
  answer_kuniHiro TEXT,                -- 国広の回答
  answer_yamamoto TEXT,                -- 山本の回答
  answer_ura TEXT,                     -- 裏の回答
  answer_kadoi TEXT,                   -- 角井の回答
  answer_hayashida TEXT,               -- 林田の回答
  answer_aso TEXT,                     -- 麻生の回答
  summary TEXT,                        -- まとめ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared_item_id にインデックス（高速検索用）
CREATE INDEX IF NOT EXISTS idx_shared_item_team_answers_shared_item_id
  ON shared_item_team_answers(shared_item_id);

-- RLS（Row Level Security）は他テーブルに合わせてバックエンドのサービスロールキーで操作
ALTER TABLE shared_item_team_answers ENABLE ROW LEVEL SECURITY;

-- サービスロールキーからのアクセスを許可
CREATE POLICY "service_role_all" ON shared_item_team_answers
  FOR ALL
  USING (true)
  WITH CHECK (true);
