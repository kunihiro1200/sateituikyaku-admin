-- 添付資料２に学校ふりがなカラムを追加（FI売主向け・OpenAI自動生成）
ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS elementary_school_furigana TEXT,
  ADD COLUMN IF NOT EXISTS junior_high_school_furigana TEXT;

COMMENT ON COLUMN seller_attached_document2.elementary_school_furigana IS '小学校名のふりがな（OpenAI生成・FI売主のみ）';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_furigana IS '中学校名のふりがな（OpenAI生成・FI売主のみ）';

NOTIFY pgrst, 'reload schema';
