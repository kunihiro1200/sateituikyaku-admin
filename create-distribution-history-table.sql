-- 他社物件新着配信の履歴テーブル
CREATE TABLE IF NOT EXISTS distribution_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_address TEXT NOT NULL,
  price TEXT NOT NULL,
  property_type TEXT,
  source_url TEXT,
  sent_count INTEGER DEFAULT 1,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 重複チェック用のインデックス（住所＋金額の完全一致）
CREATE INDEX IF NOT EXISTS idx_distribution_history_address_price 
  ON distribution_history (property_address, price);

-- 最新順で取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_distribution_history_sent_at 
  ON distribution_history (sent_at DESC);
