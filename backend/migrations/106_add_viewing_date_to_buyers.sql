-- Migration 106: Add viewing_date column to buyers table
-- This column stores the latest viewing date (内覧日（最新）) from the spreadsheet

ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS viewing_date TIMESTAMP WITH TIME ZONE;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_buyers_viewing_date ON buyers(viewing_date);

-- Add comment
COMMENT ON COLUMN buyers.viewing_date IS '内覧日（最新） - Latest viewing date from spreadsheet column I (●内覧日(最新))';
