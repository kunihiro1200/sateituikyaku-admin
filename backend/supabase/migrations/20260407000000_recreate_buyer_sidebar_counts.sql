-- Migration: Recreate buyer_sidebar_counts table with correct schema
-- Purpose: Fix NULL constraint issue - allow NULL for label and assignee
-- Related: buyer-sidebar-performance-improvement
-- Date: 2026-04-07

-- ==========================================================================
-- Drop existing table
-- ==========================================================================

DROP TABLE IF EXISTS buyer_sidebar_counts CASCADE;

-- ==========================================================================
-- Create buyer_sidebar_counts table (same design as seller_sidebar_counts)
-- ==========================================================================

CREATE TABLE buyer_sidebar_counts (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  label TEXT,           -- ✅ NULL allowed
  assignee TEXT,        -- ✅ NULL allowed
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, label, assignee)  -- ✅ Unique constraint
);

-- Add comment
COMMENT ON TABLE buyer_sidebar_counts IS '買主リストサイドバーの事前計算カウント（GASから10分ごとに更新）';
COMMENT ON COLUMN buyer_sidebar_counts.category IS 'カテゴリー名（todayCall, threeCallUnchecked等）';
COMMENT ON COLUMN buyer_sidebar_counts.count IS 'カウント数';
COMMENT ON COLUMN buyer_sidebar_counts.label IS 'ラベル（todayCallWithInfo用、NULL可）';
COMMENT ON COLUMN buyer_sidebar_counts.assignee IS '担当者名（todayCallAssigned用、NULL可）';
COMMENT ON COLUMN buyer_sidebar_counts.updated_at IS '最終更新日時';

-- ==========================================================================
-- Create index for fast lookup
-- ==========================================================================

CREATE INDEX idx_buyer_sidebar_counts_category ON buyer_sidebar_counts(category);

-- ==========================================================================
-- Disable RLS (Row Level Security)
-- ==========================================================================

ALTER TABLE buyer_sidebar_counts ENABLE ROW LEVEL SECURITY;

-- Allow all operations (GAS uses service_role key)
CREATE POLICY "Allow all operations" ON buyer_sidebar_counts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==========================================================================
-- Migration Complete
-- ==========================================================================

-- Usage example:
-- SELECT * FROM buyer_sidebar_counts WHERE category = 'todayCall';
