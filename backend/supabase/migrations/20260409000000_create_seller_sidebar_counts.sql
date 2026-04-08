-- Migration: Create seller_sidebar_counts table
-- Purpose: Pre-calculate sidebar counts for instant response (<100ms)
-- Related: seller-sidebar-realtime-category-update (Task 5.5)
-- Date: 2026-04-09

-- ==========================================================================
-- Drop existing table if exists
-- ==========================================================================

DROP TABLE IF EXISTS seller_sidebar_counts CASCADE;

-- ==========================================================================
-- Create seller_sidebar_counts table
-- ==========================================================================

CREATE TABLE seller_sidebar_counts (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  label TEXT,           -- ✅ NULL allowed (for todayCallWithInfo labels)
  assignee TEXT,        -- ✅ NULL allowed (for visitAssigned/todayCallAssigned)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, label, assignee)  -- ✅ Unique constraint
);

-- Add comments
COMMENT ON TABLE seller_sidebar_counts IS '売主リストサイドバーの事前計算カウント（トリガーで自動更新）';
COMMENT ON COLUMN seller_sidebar_counts.category IS 'カテゴリー名（todayCall, visitDayBefore, unvaluated等）';
COMMENT ON COLUMN seller_sidebar_counts.count IS 'カウント数';
COMMENT ON COLUMN seller_sidebar_counts.label IS 'ラベル（todayCallWithInfo用、NULL可）';
COMMENT ON COLUMN seller_sidebar_counts.assignee IS '担当者イニシャル（visitAssigned/todayCallAssigned用、NULL可）';
COMMENT ON COLUMN seller_sidebar_counts.updated_at IS '最終更新日時';

-- ==========================================================================
-- Create index for fast lookup
-- ==========================================================================

CREATE INDEX idx_seller_sidebar_counts_category ON seller_sidebar_counts(category);
CREATE INDEX idx_seller_sidebar_counts_assignee ON seller_sidebar_counts(assignee) WHERE assignee IS NOT NULL;
CREATE INDEX idx_seller_sidebar_counts_label ON seller_sidebar_counts(label) WHERE label IS NOT NULL;

-- ==========================================================================
-- Enable RLS (Row Level Security)
-- ==========================================================================

ALTER TABLE seller_sidebar_counts ENABLE ROW LEVEL SECURITY;

-- Allow all operations (service_role key)
CREATE POLICY "Allow all operations" ON seller_sidebar_counts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- Create trigger function to update seller_sidebar_counts
-- ==========================================================================

CREATE OR REPLACE FUNCTION update_seller_sidebar_counts()
RETURNS TRIGGER AS $$
DECLARE
  today_jst DATE;
BEGIN
  -- Get today's date in JST (UTC+9)
  today_jst := (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE;

  -- Full recalculation (simple approach for now)
  -- TODO: Optimize to only update affected categories
  
  -- Clear all counts
  DELETE FROM seller_sidebar_counts;

  -- Insert recalculated counts
  -- This will be populated by a separate service or cron job
  -- For now, we just ensure the table structure is ready

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- Create trigger on sellers table
-- ==========================================================================

-- Note: Trigger is disabled by default to avoid performance issues
-- Enable it after implementing optimized update logic

-- CREATE TRIGGER seller_sidebar_counts_trigger
--   AFTER INSERT OR UPDATE OR DELETE ON sellers
--   FOR EACH ROW
--   EXECUTE FUNCTION update_seller_sidebar_counts();

-- ==========================================================================
-- Migration Complete
-- ==========================================================================

-- Usage example:
-- SELECT * FROM seller_sidebar_counts WHERE category = 'todayCall';
-- SELECT * FROM seller_sidebar_counts WHERE category = 'visitAssigned' AND assignee = 'K';

