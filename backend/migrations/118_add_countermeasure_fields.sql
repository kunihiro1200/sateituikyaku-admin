-- Migration: 118_add_countermeasure_fields
-- Description: 修正内容まとめの各テーブルに「対策案」カラムを追加
-- Created: 2026-04-24

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_revision_countermeasure TEXT,        -- 媒介契約修正：対策案
  ADD COLUMN IF NOT EXISTS site_registration_revision_countermeasure TEXT, -- サイト登録修正：対策案
  ADD COLUMN IF NOT EXISTS floor_plan_revision_countermeasure TEXT,        -- 間取図修正（当社ミス）：対策案
  ADD COLUMN IF NOT EXISTS contract_revision_countermeasure TEXT;          -- 売買契約修正：対策案
