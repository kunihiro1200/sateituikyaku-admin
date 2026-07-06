-- Add is_rich column to buyers table
-- RICH顧客（金持ち）フラグ

ALTER TABLE buyers ADD COLUMN IF NOT EXISTS is_rich BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN buyers.is_rich IS 'RICH顧客フラグ（金持ち顧客認定）';
