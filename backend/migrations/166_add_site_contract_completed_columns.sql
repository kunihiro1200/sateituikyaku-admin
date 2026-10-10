-- Migration: 166_add_site_contract_completed_columns
--
-- Description: 契約決済タブの「ATBB成約済み」の下に、物件所在地に応じた
--   サイト別の成約済み確認項目を追加する。
--   - すまいステップ成約済み（大分県・福岡県の両方で表示）
--   - いふうHP成約済み（物件が大分県のときに表示）
--   - SUUMO成約済み（物件が福岡県のときに表示）
--   いずれも値は「確認済み」/「未」。
-- Created: 2026-10-10

ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS sumai_step_contract_completed TEXT;  -- すまいステップ成約済み（確認済み/未）
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS ifuu_hp_contract_completed TEXT;      -- いふうHP成約済み（確認済み/未）大分県
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS suumo_contract_completed TEXT;        -- SUUMO成約済み（確認済み/未）福岡県

COMMENT ON COLUMN work_tasks.sumai_step_contract_completed IS 'すまいステップ成約済み（「確認済み」/「未」）。ATBB成約済みと同時に確認。大分県・福岡県の両方で使用';
COMMENT ON COLUMN work_tasks.ifuu_hp_contract_completed IS 'いふうHP成約済み（「確認済み」/「未」）。物件が大分県のときに使用';
COMMENT ON COLUMN work_tasks.suumo_contract_completed IS 'SUUMO成約済み（「確認済み」/「未」）。物件が福岡県のときに使用';
