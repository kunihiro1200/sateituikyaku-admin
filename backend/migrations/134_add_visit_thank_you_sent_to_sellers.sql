-- 134: 訪問後お礼メール送信済みフラグを sellers テーブルに追加
-- 手動で「済」に設定した場合に、サイドバーの訪問後御礼一覧から消すためのカラム

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_thank_you_sent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN sellers.visit_thank_you_sent IS '訪問後お礼メール送信済みフラグ（手動設定可能）';
