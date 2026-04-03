-- Migration 105: Migrate visit_date to TIMESTAMP type
-- Purpose: Combine visit_date (DATE) and visit_time (VARCHAR) into single visit_date (TIMESTAMP)
-- Date: 2026-04-03

-- Step 1: Add temporary column visit_datetime as TIMESTAMP
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_datetime TIMESTAMP;

-- Step 2: Migrate existing data - Combine visit_date and visit_time into visit_datetime
UPDATE sellers
SET visit_datetime = CASE
  -- Both visit_date and visit_time exist
  WHEN visit_date IS NOT NULL AND visit_time IS NOT NULL AND visit_time != '' THEN
    (visit_date::text || ' ' || visit_time || ':00')::timestamp
  -- Only visit_date exists
  WHEN visit_date IS NOT NULL THEN
    visit_date::timestamp
  -- Neither exists
  ELSE
    NULL
END
WHERE visit_date IS NOT NULL OR visit_time IS NOT NULL;

-- Step 3: Drop visit_time column
ALTER TABLE sellers DROP COLUMN IF EXISTS visit_time;

-- Step 4: Drop old visit_date column
ALTER TABLE sellers DROP COLUMN IF EXISTS visit_date;

-- Step 5: Rename visit_datetime to visit_date
ALTER TABLE sellers RENAME COLUMN visit_datetime TO visit_date;

-- Step 6: Add comment
COMMENT ON COLUMN sellers.visit_date IS '訪問予定日時（TIMESTAMP型）';

-- Step 7: Recreate index
DROP INDEX IF EXISTS idx_sellers_visit_date;
CREATE INDEX idx_sellers_visit_date ON sellers(visit_date DESC);
