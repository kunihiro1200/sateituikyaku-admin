-- sellersテーブルに不足しているカラムを一括追加
ALTER TABLE sellers
  ADD COLUMN IF NOT EXISTS competitor_name_and_reason TEXT,
  ADD COLUMN IF NOT EXISTS other_decision_countermeasure TEXT,
  ADD COLUMN IF NOT EXISTS exclusive_other_decision_meeting TEXT,
  ADD COLUMN IF NOT EXISTS mailing_status TEXT,
  ADD COLUMN IF NOT EXISTS mail_sent_date DATE,
  ADD COLUMN IF NOT EXISTS land_area_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS building_area_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS valuation_assigned_by TEXT,
  ADD COLUMN IF NOT EXISTS appointment_notes TEXT,
  ADD COLUMN IF NOT EXISTS exclusion_date TEXT,
  ADD COLUMN IF NOT EXISTS latest_status TEXT,
  ADD COLUMN IF NOT EXISTS viewing_notes TEXT,
  ADD COLUMN IF NOT EXISTS valuation_reason TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ;
