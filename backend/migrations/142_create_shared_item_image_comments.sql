-- 共有アイテムの画像コメントテーブルを作成
CREATE TABLE IF NOT EXISTS shared_item_image_comments (
  id SERIAL PRIMARY KEY,
  shared_item_id VARCHAR(50) NOT NULL, -- スプレッドシートのID列に対応
  image_number INTEGER NOT NULL CHECK (image_number >= 1 AND image_number <= 10),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shared_item_id, image_number)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shared_item_image_comments_item_id ON shared_item_image_comments(shared_item_id);

-- コメント追加
COMMENT ON TABLE shared_item_image_comments IS '共有アイテムの画像コメント（DBのみ保存、スプレッドシート非同期）';
COMMENT ON COLUMN shared_item_image_comments.shared_item_id IS 'スプレッドシートのID列の値';
COMMENT ON COLUMN shared_item_image_comments.image_number IS '画像番号（1〜10）';
COMMENT ON COLUMN shared_item_image_comments.comment IS '画像に対するコメント';
