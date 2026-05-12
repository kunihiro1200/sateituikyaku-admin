-- Migration: 124_add_mediation_delivery_and_print_fields
-- Description: 媒介契約タブに「お渡し手段」「郵送前営業確認」「印刷OR郵送準備」フィールドを追加
-- Created: 2026-05-12

-- 新しいカラムを追加
ALTER TABLE work_tasks
  ADD COLUMN IF NOT EXISTS mediation_delivery_method TEXT,           -- お渡し手段（GASから転記、編集不可）
  ADD COLUMN IF NOT EXISTS mediation_pre_mail_check TEXT,            -- 郵送前営業確認（GASから転記、編集不可）
  ADD COLUMN IF NOT EXISTS mediation_print_or_mail_prep TEXT;        -- 印刷OR郵送準備（DB編集可能、スプシにカラムなし）

-- コメント追加
COMMENT ON COLUMN work_tasks.mediation_delivery_method IS 'お渡し手段（GASから転記、編集不可）';
COMMENT ON COLUMN work_tasks.mediation_pre_mail_check IS '郵送前営業確認（GASから転記、編集不可、お渡し手段に「郵送」が含まれる場合のみ表示）';
COMMENT ON COLUMN work_tasks.mediation_print_or_mail_prep IS '印刷OR郵送準備（DB編集可能、選択肢は「済」のみ）';
