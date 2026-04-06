-- Migration: Add Partial Index for buyers.deleted_at IS NULL
-- Purpose: Optimize queries that filter active buyers (deleted_at IS NULL)
-- Related: buyer-sidebar-performance-improvement (Requirements 4.2)
-- Date: 2026-04-06

-- ==========================================================================
-- Create partial index for active buyers (deleted_at IS NULL)
-- ==========================================================================

-- Drop existing full index if it exists
DROP INDEX IF EXISTS idx_buyers_deleted_at;

-- Create partial index for active buyers only
CREATE INDEX idx_buyers_deleted_at ON buyers(deleted_at) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON INDEX idx_buyers_deleted_at IS 'アクティブな買主（deleted_at IS NULL）のクエリを高速化する部分インデックス';

-- ==========================================================================
-- Migration Complete
-- ==========================================================================

-- Usage example:
-- SELECT * FROM buyers WHERE deleted_at IS NULL;
-- This query will use the partial index for faster performance.
