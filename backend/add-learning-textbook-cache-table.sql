-- 営業学習教科書キャッシュテーブル
CREATE TABLE IF NOT EXISTS learning_textbook_cache (
  id TEXT PRIMARY KEY DEFAULT 'main',
  textbook_json JSONB NOT NULL,
  answer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
