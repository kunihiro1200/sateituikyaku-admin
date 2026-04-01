-- buyer_sidebar_countsテーブルを削除して再作成
DROP TABLE IF EXISTS buyer_sidebar_counts;

-- 正しいスキーマで再作成
-- label と assignee は NOT NULL（GAS側で null を '' に変換する）
CREATE TABLE buyer_sidebar_counts (
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  assignee TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, label, assignee)
);

-- インデックスを作成
CREATE INDEX idx_buyer_sidebar_counts_category ON buyer_sidebar_counts(category);
