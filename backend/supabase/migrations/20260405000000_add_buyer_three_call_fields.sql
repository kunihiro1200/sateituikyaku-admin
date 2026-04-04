-- 買主テーブルに新規カラムを追加

-- ３回架電確認済みカラム
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS three_call_confirmed TEXT;

-- 【問合メール】電話対応カラム
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS inquiry_email_phone_response TEXT;

-- インデックスを追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_buyers_three_call_confirmed
ON buyers(three_call_confirmed)
WHERE three_call_confirmed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buyers_inquiry_email_phone_response
ON buyers(inquiry_email_phone_response)
WHERE inquiry_email_phone_response IS NOT NULL;

-- コメント
COMMENT ON COLUMN buyers.three_call_confirmed IS '３回架電確認済み（"3回架電未" or その他）';
COMMENT ON COLUMN buyers.inquiry_email_phone_response IS '【問合メール】電話対応（"不通", "未", その他）';
