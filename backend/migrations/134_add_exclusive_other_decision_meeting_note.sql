-- 専任他決打合せセクションの「追記」欄を追加
-- 完了ボタンの右隣に表示する「追記」ボタンから入力するロングテキスト欄
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS exclusive_other_decision_meeting_note TEXT;

COMMENT ON COLUMN sellers.exclusive_other_decision_meeting_note IS '専任他決打合せ：追記欄（入力があると未訪問他決一覧でピンク表示）';
