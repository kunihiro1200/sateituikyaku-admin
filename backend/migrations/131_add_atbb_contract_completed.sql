-- Migration: 131_add_atbb_contract_completed
-- Description: 「ATBB成約済み」フィールドを追加（台帳作成済みの下に表示）
-- Created: 2026-08-09

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS atbb_contract_completed TEXT;  -- ATBB成約済み（N/Y）
