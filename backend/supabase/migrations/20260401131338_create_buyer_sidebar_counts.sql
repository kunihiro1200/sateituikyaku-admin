-- 買主サイドバーカウントテーブルの作成
-- 売主リストと同じアプローチで、サイドバーカウントを事前計算して保存

CREATE TABLE IF NOT EXISTS buyer_sidebar_counts (
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  assignee TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, label, assignee)
);

-- カテゴリカラムにインデックスを作成（高速検索用）
CREATE INDEX IF NOT EXISTS idx_buyer_sidebar_counts_category 
  ON buyer_sidebar_counts(category);

-- 更新日時カラムにインデックスを作成（最新データの確認用）
CREATE INDEX IF NOT EXISTS idx_buyer_sidebar_counts_updated_at 
  ON buyer_sidebar_counts(updated_at DESC);

-- コメント
COMMENT ON TABLE buyer_sidebar_counts IS '買主サイドバーカウント（GASで10分ごとに更新）';
COMMENT ON COLUMN buyer_sidebar_counts.category IS 'カテゴリ名（例: todayCall, visitDayBefore）';
COMMENT ON COLUMN buyer_sidebar_counts.count IS 'カウント数';
COMMENT ON COLUMN buyer_sidebar_counts.label IS 'ラベル（例: 当日TEL（内容）の場合）';
COMMENT ON COLUMN buyer_sidebar_counts.assignee IS '担当者イニシャル（例: 当日TEL(Y)の場合）';
COMMENT ON COLUMN buyer_sidebar_counts.updated_at IS '更新日時';
