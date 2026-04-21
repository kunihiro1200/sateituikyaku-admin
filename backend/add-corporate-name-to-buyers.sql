-- buyers テーブルに corporate_name カラムを追加（EE列「法人名」）
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS corporate_name TEXT;
