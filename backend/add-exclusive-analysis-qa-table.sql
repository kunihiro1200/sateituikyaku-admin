-- 専任媒介取得分析QAテーブル
-- 担当者の専任取得成功要因をAIが質問し、担当者が回答する形式で蓄積する
-- 他スタッフへの学習コンテンツとして活用

CREATE TABLE IF NOT EXISTS exclusive_analysis_qa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 起点となる売主ID（この売主から分析ページを開いた）
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  
  -- 営業担当のイニシャル（visit_assignee）
  assignee TEXT NOT NULL,
  
  -- 対象年月（YYYY-MM形式）
  target_month TEXT NOT NULL,
  
  -- AIが生成した質問リスト（JSON配列: [{id, question}]）
  ai_questions JSONB NOT NULL DEFAULT '[]',
  
  -- 担当者の回答（JSON配列: [{questionId, answer}]）
  answers JSONB NOT NULL DEFAULT '[]',
  
  -- 公開フラグ（他スタッフに公開するか）
  is_published BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_exclusive_analysis_qa_seller_id ON exclusive_analysis_qa(seller_id);
CREATE INDEX IF NOT EXISTS idx_exclusive_analysis_qa_assignee ON exclusive_analysis_qa(assignee);
CREATE INDEX IF NOT EXISTS idx_exclusive_analysis_qa_target_month ON exclusive_analysis_qa(target_month);

-- seller_id + assignee + target_month でユニーク（1担当者・1ヶ月・1起点売主につき1レコード）
CREATE UNIQUE INDEX IF NOT EXISTS idx_exclusive_analysis_qa_unique
  ON exclusive_analysis_qa(seller_id, assignee, target_month);
