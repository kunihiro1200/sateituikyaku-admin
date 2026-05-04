-- 既存のscraped_urlsテーブルに参照元URLとスクレイピング後のURLカラムを追加
-- （テーブルが既に存在する場合のマイグレーション用）

-- reference_urlカラムを追加
ALTER TABLE scraped_urls
ADD COLUMN IF NOT EXISTS reference_url TEXT;

-- scraped_result_urlカラムを追加
ALTER TABLE scraped_urls
ADD COLUMN IF NOT EXISTS scraped_result_url TEXT;

-- コメントを追加
COMMENT ON COLUMN scraped_urls.reference_url IS '参照元URL（スクレイピング元のページURL）';
COMMENT ON COLUMN scraped_urls.scraped_result_url IS 'スクレイピング後のURL（公開物件サイトのURL）';
