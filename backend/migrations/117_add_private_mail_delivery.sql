-- 非公開配信メールフィールドを追加
-- 毎月第2土曜日に手動でメール配信する「非公開（配信メールのみ）」カテゴリー用

ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS private_mail_delivery VARCHAR(10) DEFAULT NULL;

-- インデックス（サイドバーカウント計算の高速化）
CREATE INDEX IF NOT EXISTS idx_property_listings_private_mail_delivery
  ON property_listings (private_mail_delivery)
  WHERE private_mail_delivery IS NOT NULL;

COMMENT ON COLUMN property_listings.private_mail_delivery IS '非公開配信メール: 毎月第2土曜日に未にリセット。手動で済にするとサイドバーから消える。';
