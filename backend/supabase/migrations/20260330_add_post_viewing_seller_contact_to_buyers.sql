-- 内覧後売主連絡カラムの追加
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS post_viewing_seller_contact TEXT;
