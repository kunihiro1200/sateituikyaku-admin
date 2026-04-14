-- employeesテーブルにphone_numberカラムを追加
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN public.employees.phone_number IS '担当者の携帯電話番号（メール署名用）';

-- PostgRESTのスキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';
