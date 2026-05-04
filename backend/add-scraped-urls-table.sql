-- スクレイピングしたURLを保存するテーブル
CREATE TABLE IF NOT EXISTS scraped_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL UNIQUE, -- 元のURL（重複チェックのキー）
  reference_url TEXT, -- 参照元URL（スクレイピング元のページURL）
  scraped_result_url TEXT, -- スクレイピング後のURL（公開物件サイトのURL）
  property_number TEXT, -- 物件番号（athomeの場合は details.物件番号）
  source_site TEXT NOT NULL, -- スクレイピング元サイト（'athome', 'suumo'など）
  title TEXT, -- 物件タイトル
  price TEXT, -- 価格
  address TEXT, -- 住所
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- スクレイピング日時
  posted_to_db BOOLEAN DEFAULT FALSE, -- DBに掲載済みかどうか
  posted_at TIMESTAMP WITH TIME ZONE, -- 掲載日時
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- URLでの検索を高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_scraped_urls_url ON scraped_urls(url);

-- 物件番号での検索を高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_scraped_urls_property_number ON scraped_urls(property_number);

-- スクレイピング元サイトでの検索を高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_scraped_urls_source_site ON scraped_urls(source_site);

-- 掲載済みフラグでの検索を高速化するインデックス
CREATE INDEX IF NOT EXISTS idx_scraped_urls_posted_to_db ON scraped_urls(posted_to_db);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_scraped_urls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scraped_urls_updated_at
  BEFORE UPDATE ON scraped_urls
  FOR EACH ROW
  EXECUTE FUNCTION update_scraped_urls_updated_at();

COMMENT ON TABLE scraped_urls IS 'スクレイピングしたURLの履歴を保存し、重複掲載を防ぐためのテーブル';
COMMENT ON COLUMN scraped_urls.url IS '元のURL（重複チェックのキー）';
COMMENT ON COLUMN scraped_urls.reference_url IS '参照元URL（スクレイピング元のページURL）';
COMMENT ON COLUMN scraped_urls.scraped_result_url IS 'スクレイピング後のURL（公開物件サイトのURL）';
COMMENT ON COLUMN scraped_urls.property_number IS '物件番号（athomeの場合は details.物件番号）';
COMMENT ON COLUMN scraped_urls.source_site IS 'スクレイピング元サイト（athome, suumoなど）';
COMMENT ON COLUMN scraped_urls.posted_to_db IS 'DBに掲載済みかどうか';
COMMENT ON COLUMN scraped_urls.posted_at IS 'DBに掲載した日時';
