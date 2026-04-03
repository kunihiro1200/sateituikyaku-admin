-- Migration: Add viewing_time column to buyers table
-- This column stores the viewing time (●時間) from the spreadsheet

ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS viewing_time VARCHAR(20);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_buyers_viewing_time ON buyers(viewing_time);

-- Add comment
COMMENT ON COLUMN buyers.viewing_time IS '内覧時間 - Viewing time from spreadsheet column BP (●時間)';
