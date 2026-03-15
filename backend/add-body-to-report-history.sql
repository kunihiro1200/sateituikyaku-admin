-- property_report_history テーブルに body カラムを追加
ALTER TABLE property_report_history ADD COLUMN IF NOT EXISTS body TEXT;
