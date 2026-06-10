-- 他決AI分析キャッシュテーブル（専任と同様の仕組み）
CREATE TABLE IF NOT EXISTS other_decision_ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee TEXT NOT NULL,
  target_month TEXT NOT NULL,
  ai_analysis TEXT NOT NULL,
  case_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignee, target_month)
);
