-- buyers テーブルに other_company_property_info カラムを追加する
-- 他社物件情報（物件番号未設定時に担当者が自由記述で入力する他社物件情報）
ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS other_company_property_info TEXT;

COMMENT ON COLUMN buyers.other_company_property_info IS
  '他社物件情報（物件番号未設定時に担当者が自由記述で入力する他社物件情報）';
