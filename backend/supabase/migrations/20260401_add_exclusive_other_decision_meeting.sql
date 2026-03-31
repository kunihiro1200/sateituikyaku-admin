-- 専任他決打合せカラムを追加
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS exclusive_other_decision_meeting TEXT NULL;

-- コメント追加
COMMENT ON COLUMN sellers.exclusive_other_decision_meeting IS '専任他決打合せ（専任、他決、または一般が決定した際の打合せ内容）';
