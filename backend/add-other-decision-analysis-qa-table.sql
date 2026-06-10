-- 他決分析QAテーブル
CREATE TABLE IF NOT EXISTS other_decision_analysis_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  assignee TEXT NOT NULL,
  target_month TEXT NOT NULL,
  ai_questions JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_other_decision_analysis_qa_unique
  ON other_decision_analysis_qa(seller_id, assignee, target_month);
