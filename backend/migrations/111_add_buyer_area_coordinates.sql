-- Migration: Add coordinates to buyers table for radius search
-- Description: Add latitude and longitude columns for desired area

-- Add columns
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS desired_area_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS desired_area_lng DOUBLE PRECISION;

-- Add index for efficient radius search
CREATE INDEX IF NOT EXISTS idx_buyers_desired_area_coordinates 
ON buyers(desired_area_lat, desired_area_lng) 
WHERE desired_area_lat IS NOT NULL AND desired_area_lng IS NOT NULL;

-- Add comments
COMMENT ON COLUMN buyers.desired_area_lat IS '希望エリアの緯度（半径検索用）';
COMMENT ON COLUMN buyers.desired_area_lng IS '希望エリアの経度（半径検索用）';
