-- Migration: 157_add_mediation_commission_fields
-- Date: 2026-09-11
-- Purpose: 媒介依頼シートB23（仲介手数料種別）・上長確認チェックボックス3種を追加

-- B23の値をGASが書き込むカラム（「他」かどうかの判定に使用）
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_commission_type TEXT;

-- 仲介手数料が「他」の場合の上長確認チェックボックス（フロントエンドから保存）
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_commission_approval_yamamoto BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mediation_commission_approval_kunihiro BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mediation_commission_approval_unnecessary BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN work_tasks.mediation_commission_type IS '個別物件スプシ「媒介依頼」シートB23の値（GASが転記）。「他」の場合に上長確認チェックが必須になる';
COMMENT ON COLUMN work_tasks.mediation_commission_approval_yamamoto IS '仲介手数料「他」の上長確認：山本';
COMMENT ON COLUMN work_tasks.mediation_commission_approval_kunihiro IS '仲介手数料「他」の上長確認：国広';
COMMENT ON COLUMN work_tasks.mediation_commission_approval_unnecessary IS '仲介手数料「他」の上長確認：不要';
