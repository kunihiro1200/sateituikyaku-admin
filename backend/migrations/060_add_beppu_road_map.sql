-- Migration: 060_add_beppu_road_map
-- Description: work_tasksテーブルに別府市道路台帳図の画像URLカラムを追加
-- Created: 2026-05-13

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS beppu_road_map_image_url TEXT,
  ADD COLUMN IF NOT EXISTS beppu_road_map_page_no INTEGER;

COMMENT ON COLUMN work_tasks.beppu_road_map_image_url IS '別府市道路台帳図の画像URL（Supabase Storage）';
COMMENT ON COLUMN work_tasks.beppu_road_map_page_no IS '別府市道路台帳図の該当番号（AI自動判定）';
