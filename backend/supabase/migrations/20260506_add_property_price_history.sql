-- 物件価格履歴テーブル
CREATE TABLE IF NOT EXISTS property_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_number TEXT NOT NULL REFERENCES buyers(buyer_number) ON DELETE CASCADE,
  property_url TEXT NOT NULL,
  price BIGINT, -- 価格（円）、取得できない場合はNULL
  status TEXT, -- 'available'（販売中）, 'sold'（売却済み）, 'deleted'（削除）
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_property_price_history_buyer_number ON property_price_history(buyer_number);
CREATE INDEX IF NOT EXISTS idx_property_price_history_url ON property_price_history(property_url);
CREATE INDEX IF NOT EXISTS idx_property_price_history_scraped_at ON property_price_history(scraped_at DESC);

-- コメント
COMMENT ON TABLE property_price_history IS '建売専門HPの物件価格履歴';
COMMENT ON COLUMN property_price_history.buyer_number IS '買主番号';
COMMENT ON COLUMN property_price_history.property_url IS '物件URL';
COMMENT ON COLUMN property_price_history.price IS '価格（円）';
COMMENT ON COLUMN property_price_history.status IS '物件ステータス（available/sold/deleted）';
COMMENT ON COLUMN property_price_history.scraped_at IS 'スクレイピング実行日時';
