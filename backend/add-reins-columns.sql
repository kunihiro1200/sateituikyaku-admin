-- レインズ登録ページ用カラムをproperty_listingsテーブルに追加
ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS reins_url TEXT,
ADD COLUMN IF NOT EXISTS reins_certificate_email TEXT,
ADD COLUMN IF NOT EXISTS cc_assignee TEXT,
ADD COLUMN IF NOT EXISTS report_date_setting TEXT;

COMMENT ON COLUMN public.property_listings.reins_url IS 'レインズURL';
COMMENT ON COLUMN public.property_listings.reins_certificate_email IS 'レインズ証明書メール済み（連絡済み/未）';
COMMENT ON COLUMN public.property_listings.cc_assignee IS '担当をCCにいれる（済/未）';
COMMENT ON COLUMN public.property_listings.report_date_setting IS '報告日設定（する/しない）';

-- PostgRESTのスキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';
