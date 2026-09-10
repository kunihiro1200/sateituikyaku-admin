-- Migration: Add supervisor approval fields to work_tasks table
-- Date: 2026-09-11
-- Purpose: 仲介手数料と通常仲介手数料に差異がある場合の上長承認チェックボックス追加

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS supervisor_approval_kunihiro BOOLEAN DEFAULT FALSE;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS supervisor_approval_yamamoto BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN work_tasks.supervisor_approval_kunihiro IS '上長の許可（国広）: 仲介手数料と通常仲介手数料に差異がある場合に必須';
COMMENT ON COLUMN work_tasks.supervisor_approval_yamamoto IS '上長の許可（山本）: 仲介手数料と通常仲介手数料に差異がある場合に必須';
