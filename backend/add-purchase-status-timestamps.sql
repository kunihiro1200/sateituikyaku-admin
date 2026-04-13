-- 買付ステータス更新日時カラムの追加
-- バグ修正: 買付ステータスバッジ表示優先順位の修正に必要なタイムスタンプカラムを追加する
-- 参照: .kiro/specs/property-listing-purchase-status-priority-fix/

-- property_listingsテーブルへの追加
-- offer_statusが最後に更新された日時を記録する
ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS offer_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.property_listings.offer_status_updated_at IS '買付ステータス(offer_status)の最終更新日時';

-- buyersテーブルへの追加
-- latest_statusが最後に更新された日時を記録する
ALTER TABLE public.buyers
ADD COLUMN IF NOT EXISTS latest_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.buyers.latest_status_updated_at IS '買主最新ステータス(latest_status)の最終更新日時';

-- PostgRESTのスキーマキャッシュをリロード
NOTIFY pgrst, 'reload schema';
