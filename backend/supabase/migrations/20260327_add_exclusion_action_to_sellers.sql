-- exclusion_action カラムを sellers テーブルに追加
-- 除外日にすること（例：「除外日にする」「除外しない」など）を格納するフィールド
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS exclusion_action TEXT;
