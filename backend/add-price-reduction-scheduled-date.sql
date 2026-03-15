-- price_reduction_scheduled_date カラムを property_listings テーブルに追加
ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS price_reduction_scheduled_date DATE;

COMMENT ON COLUMN public.property_listings.price_reduction_scheduled_date IS '値下げ予約日';

-- PostgRESTのスキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';
