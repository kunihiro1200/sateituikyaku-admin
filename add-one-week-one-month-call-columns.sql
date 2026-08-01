-- 1週間架電確認済み・1か月後架電確認済みカラム追加
-- 3回架電確認済みの下に表示される新しいフィールド

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS one_week_call_confirmed TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS one_month_call_confirmed TEXT;

-- コメント
COMMENT ON COLUMN buyers.one_week_call_confirmed IS '1週間架電確認済み: OK/未/他';
COMMENT ON COLUMN buyers.one_month_call_confirmed IS '1か月後架電確認済み: OK/未/他';
