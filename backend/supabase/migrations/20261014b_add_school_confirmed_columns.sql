-- 添付資料２に学校確認チェックボックス列を追加
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS elementary_school_confirmed  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS junior_high_school_confirmed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN seller_attached_document2.elementary_school_confirmed  IS '小学校情報の確認済みフラグ';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_confirmed IS '中学校情報の確認済みフラグ';

NOTIFY pgrst, 'reload schema';
