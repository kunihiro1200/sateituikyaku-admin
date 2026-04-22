-- work_tasks テーブルへの売主・買主関連カラム追加
-- べき等性確保のため ADD COLUMN IF NOT EXISTS を使用

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS seller_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS seller_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS seller_contact_tel TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS buyer_contact_tel TEXT,
  ADD COLUMN IF NOT EXISTS loan TEXT,
  ADD COLUMN IF NOT EXISTS financial_institution TEXT,
  ADD COLUMN IF NOT EXISTS delivery_scheduled_date DATE;
