-- 営業会議の物件数チーム・契約率チームの各担当者回答に公開状態フラグを追加
-- 各スタッフが自分のタイミングで「公開」ボタンを押して他のメンバーに見せる機能

ALTER TABLE shared_item_team_answers
ADD COLUMN IF NOT EXISTS is_kunihiro_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_yamamoto_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_ura_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_kadoi_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_hayashida_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_aso_visible BOOLEAN DEFAULT FALSE;

-- 各カラムのコメント
COMMENT ON COLUMN shared_item_team_answers.is_kunihiro_visible IS '国広の回答が公開されているか（TRUE=公開、FALSE=非公開）';
COMMENT ON COLUMN shared_item_team_answers.is_yamamoto_visible IS '山本の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_ura_visible IS '裏の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_kadoi_visible IS '角井の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_hayashida_visible IS '林田の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_aso_visible IS '麻生の回答が公開されているか';
