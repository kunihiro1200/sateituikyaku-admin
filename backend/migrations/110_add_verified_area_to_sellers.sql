-- ============================================================================
-- Migration: Add land_area_verified and building_area_verified to sellers table
-- Date: 2026-04-01
-- Description: スプレッドシート同期のため、sellersテーブルに土地面積（当社調べ）と建物面積（当社調べ）を追加
-- ============================================================================

-- Add land_area_verified and building_area_verified columns to sellers table
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS land_area_verified DECIMAL(10, 2);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS building_area_verified DECIMAL(10, 2);

-- Add comments
COMMENT ON COLUMN sellers.land_area_verified IS '土地面積（当社調べ）- 平方メートル';
COMMENT ON COLUMN sellers.building_area_verified IS '建物面積（当社調べ）- 平方メートル';
