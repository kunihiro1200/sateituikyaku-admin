-- 買主内覧 気づきQA（担当者ごとの質問と回答を保存）
CREATE TABLE IF NOT EXISTS buyer_insight_qa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  end_date DATE NOT NULL,
  assignee TEXT NOT NULL,
  ai_questions JSONB DEFAULT '[]'::jsonb,
  answers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 担当者+期限日でユニーク
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_insight_qa_assignee_date 
  ON buyer_insight_qa (assignee, end_date);
