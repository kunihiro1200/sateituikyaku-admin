-- 買主テーブルにコミュニケーション情報カラムを追加
-- 売主リストと同じ「電話担当」「連絡取りやすい日時」「連絡方法」を買主にも追加

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS phone_contact_person TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS contact_method TEXT;

COMMENT ON COLUMN buyers.phone_contact_person IS '電話担当（任意）- スタッフのイニシャル';
COMMENT ON COLUMN buyers.preferred_contact_time IS '連絡取りやすい日、時間帯';
COMMENT ON COLUMN buyers.contact_method IS '連絡方法（電話/Eメール等）';
