-- Migration 141: Add matching_required and desired_conditions_updated_at to buyers
-- Created: 2026-08-20
-- Purpose: Track matching requirement status and desired conditions update time

-- Add matching_required flag to buyers table
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS matching_required BOOLEAN DEFAULT NULL;

-- matching_required values:
-- - NULL: Not set (no desired conditions entered or matching choice not made)
-- - TRUE: Matching required
-- - FALSE: Matching not required

-- Add desired_conditions_updated_at to buyers table
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS desired_conditions_updated_at TIMESTAMPTZ DEFAULT NULL;

-- desired_conditions_updated_at:
-- - Records when desired conditions (area, property type, price range, etc.) were last updated
-- - Used to determine if matching should be updated when viewing results are updated

-- Add comments
COMMENT ON COLUMN buyers.matching_required IS 'Matching required flag: NULL=not set, TRUE=matching required, FALSE=matching not required';
COMMENT ON COLUMN buyers.desired_conditions_updated_at IS 'Last update time of desired conditions (used for viewing result update judgment)';
