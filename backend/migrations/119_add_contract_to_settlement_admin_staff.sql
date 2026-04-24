-- Migration: 119_add_contract_to_settlement_admin_staff
-- Description: 「契約～決済までに事務担当者」フィールドを追加
--   - contract_to_settlement_admin_staff: 担当者（R/久/和/他）
--   - contract_to_settlement_admin_approver: 「他」選択時の許可者（山本/国広）
--   - contract_to_settlement_admin_person: 担当者（全社員から選択）
-- Created: 2026-04-25

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS contract_to_settlement_admin_staff TEXT,      -- 契約～決済担当者（R/久/和/他）
  ADD COLUMN IF NOT EXISTS contract_to_settlement_admin_approver TEXT,   -- 「他」選択時の許可者（山本/国広）
  ADD COLUMN IF NOT EXISTS contract_to_settlement_admin_person TEXT;     -- 担当者（全社員から選択）
