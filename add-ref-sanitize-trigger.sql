-- work_tasksテーブルに#REF!等のスプレッドシートエラー値が書き込まれた場合、
-- 自動的にnullに変換するトリガー
-- 
-- 実行方法: Supabase SQL Editorで実行
-- 作成日: 2026-05-21
-- 理由: GASの10分同期でスプシの#REF!エラーがDBに書き込まれる問題の根本対策

CREATE OR REPLACE FUNCTION sanitize_ref_errors()
RETURNS TRIGGER AS $$
BEGIN
  -- property_address
  IF NEW.property_address IS NOT NULL AND NEW.property_address ~ '^#(REF|N/A|VALUE|ERROR|NAME\?|NULL|DIV/0)!?$' THEN
    NEW.property_address := NULL;
  END IF;
  -- seller_name
  IF NEW.seller_name IS NOT NULL AND NEW.seller_name ~ '^#(REF|N/A|VALUE|ERROR|NAME\?|NULL|DIV/0)!?$' THEN
    NEW.seller_name := NULL;
  END IF;
  -- sales_assignee
  IF NEW.sales_assignee IS NOT NULL AND NEW.sales_assignee ~ '^#(REF|N/A|VALUE|ERROR|NAME\?|NULL|DIV/0)!?$' THEN
    NEW.sales_assignee := NULL;
  END IF;
  -- property_type
  IF NEW.property_type IS NOT NULL AND NEW.property_type ~ '^#(REF|N/A|VALUE|ERROR|NAME\?|NULL|DIV/0)!?$' THEN
    NEW.property_type := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_ref_errors ON work_tasks;
CREATE TRIGGER trg_sanitize_ref_errors
  BEFORE INSERT OR UPDATE ON work_tasks
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_ref_errors();
