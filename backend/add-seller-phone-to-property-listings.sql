-- property_listings テーブルに seller_phone カラムを追加
-- 売主電話番号（復号済み）を保存するカラム
-- seller_name と同様に PropertyListingSyncService で同期される

ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS seller_phone TEXT;

COMMENT ON COLUMN public.property_listings.seller_phone IS '売主電話番号（復号済み）';
