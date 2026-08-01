-- 物件テーブルの構造（structure）チェック制約を更新
-- 問題: フロントエンドでは 'RC', 'SRC' が選択肢にあるが、DBの制約に含まれていない
-- マンション登録時に 'RC' を選択すると properties_structure_check 違反になる

-- 既存のチェック制約を削除
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_structure_check;

-- VARCHAR(20)のカラムレベルCHECK制約の場合、制約名が自動生成されている可能性がある
-- 以下も試す
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- structureカラムに関連するCHECK制約を全て探して削除
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'properties'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%structure%'
    LOOP
        EXECUTE 'ALTER TABLE properties DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- 新しいチェック制約を追加（RC, SRC を含む）
ALTER TABLE properties ADD CONSTRAINT properties_structure_check 
  CHECK (structure IN ('木造', '軽量鉄骨', '鉄骨', 'RC', 'SRC', '他'));
