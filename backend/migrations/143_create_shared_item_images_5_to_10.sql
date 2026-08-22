-- 共有アイテムの画像5〜10をDBのみに保存するテーブル
CREATE TABLE IF NOT EXISTS shared_item_images (
  id SERIAL PRIMARY KEY,
  shared_item_id VARCHAR(50) NOT NULL, -- スプレッドシートのID列に対応
  image_number INTEGER NOT NULL CHECK (image_number >= 5 AND image_number <= 10),
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shared_item_id, image_number)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shared_item_images_item_id ON shared_item_images(shared_item_id);

-- コメント追加
COMMENT ON TABLE shared_item_images IS '共有アイテムの画像5〜10（DBのみ保存、スプレッドシート非同期）';
COMMENT ON COLUMN shared_item_images.shared_item_id IS 'スプレッドシートのID列の値';
COMMENT ON COLUMN shared_item_images.image_number IS '画像番号（5〜10）';
COMMENT ON COLUMN shared_item_images.image_url IS '画像URL（Supabase Storage）';
