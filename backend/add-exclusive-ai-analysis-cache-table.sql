-- AI分析キャッシュを専用テーブルに分離
-- QA（質問・回答）とAI分析キャッシュを独立させる

CREATE TABLE IF NOT EXISTS exclusive_ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee TEXT NOT NULL,
  target_month TEXT NOT NULL,       -- YYYY-MM形式
  ai_analysis TEXT NOT NULL,
  case_count INTEGER NOT NULL DEFAULT 0,  -- キャッシュ時の案件数（変化検知用）
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignee, target_month)
);

CREATE INDEX IF NOT EXISTS idx_exclusive_ai_analysis_cache_assignee_month
  ON exclusive_ai_analysis_cache(assignee, target_month);
