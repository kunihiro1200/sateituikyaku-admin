-- ============================================================================
-- 115 092_recreate_sellers_no_constraints.sql で再作成後に欠落したカラムを追加
-- createSeller で使用する全フィールドを追加
-- ============================================================================

-- 追客情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS next_call_date DATE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS contact_method TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT;

-- 訪問査定情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_date DATE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_time VARCHAR(20);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_assignee VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_notes TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_acquisition_date DATE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_valuation_acquirer VARCHAR(100);

-- ステータス・コメント
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- 査定情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_amount_1 BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_amount_2 BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_amount_3 BIGINT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS valuation_assignee VARCHAR(100);

-- 基本情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS status VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(50);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_call_person VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_caller_initials VARCHAR(10);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS first_caller_employee_id UUID;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_unreachable BOOLEAN DEFAULT FALSE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS unreachable_status TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS duplicate_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS exclusion_date TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_source TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_year INTEGER;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_date DATE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_site VARCHAR(100);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS inquiry_detailed_datetime TIMESTAMP WITH TIME ZONE;

-- 重複検出用ハッシュ
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS phone_number_hash TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email_hash TEXT;

-- 競合情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS competitor_name TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS exclusive_other_decision_factor TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS competitor_name_and_reason TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS other_decision_countermeasure TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS exclusive_other_decision_meeting TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS contract_year_month TEXT;

-- 郵送情報
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mailing_status TEXT;

-- Pinrich
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pinrich_status TEXT;

-- その他
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS phone_contact_person TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS property_address TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sellers_next_call_date ON sellers(next_call_date);
CREATE INDEX IF NOT EXISTS idx_sellers_visit_assignee ON sellers(visit_assignee);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_phone_number_hash ON sellers(phone_number_hash);
CREATE INDEX IF NOT EXISTS idx_sellers_email_hash ON sellers(email_hash);

DO $$
BEGIN
  RAISE NOTICE '✅ 115: 欠落していた全カラムを追加しました';
END $$;
