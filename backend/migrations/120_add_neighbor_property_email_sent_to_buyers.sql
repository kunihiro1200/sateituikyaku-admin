-- Migration 120: Add neighbor_property_email_sent to buyers table
-- Description: 近隣物件送付メールフィールドを追加（「済」「不要」のボタン選択）

ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS neighbor_property_email_sent TEXT;

COMMENT ON COLUMN buyers.neighbor_property_email_sent IS '近隣物件送付メール（済/不要）';
