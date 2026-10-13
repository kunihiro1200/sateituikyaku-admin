-- Migration: 添付資料２に学校距離・正門座標カラムを追加
-- 物件から小学校・中学校までの道路距離（m）・徒歩時間・正門座標・取得日時

ALTER TABLE seller_attached_document2
  ADD COLUMN IF NOT EXISTS elementary_school_distance     INTEGER,         -- 小学校までの道路距離（m）
  ADD COLUMN IF NOT EXISTS elementary_school_entrance_lat NUMERIC(10, 7),  -- 小学校正門の緯度
  ADD COLUMN IF NOT EXISTS elementary_school_entrance_lng NUMERIC(10, 7),  -- 小学校正門の経度
  ADD COLUMN IF NOT EXISTS junior_high_school_distance    INTEGER,         -- 中学校までの道路距離（m）
  ADD COLUMN IF NOT EXISTS junior_high_school_entrance_lat NUMERIC(10, 7), -- 中学校正門の緯度
  ADD COLUMN IF NOT EXISTS junior_high_school_entrance_lng NUMERIC(10, 7), -- 中学校正門の経度
  ADD COLUMN IF NOT EXISTS school_info_fetched_at         TIMESTAMPTZ;     -- 学校情報の最終取得日時

COMMENT ON COLUMN seller_attached_document2.elementary_school_distance      IS '小学校までの道路距離（m）- Google Maps Directions API取得';
COMMENT ON COLUMN seller_attached_document2.elementary_school_entrance_lat  IS '小学校正門の緯度（カスタム設定、なければPlaces API取得座標）';
COMMENT ON COLUMN seller_attached_document2.elementary_school_entrance_lng  IS '小学校正門の経度（カスタム設定、なければPlaces API取得座標）';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_distance     IS '中学校までの道路距離（m）- Google Maps Directions API取得';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_entrance_lat IS '中学校正門の緯度（カスタム設定、なければPlaces API取得座標）';
COMMENT ON COLUMN seller_attached_document2.junior_high_school_entrance_lng IS '中学校正門の経度（カスタム設定、なければPlaces API取得座標）';
COMMENT ON COLUMN seller_attached_document2.school_info_fetched_at          IS '学校情報の最終取得日時（Google Maps API キャッシュ管理用）';

-- スキーマキャッシュを更新
NOTIFY pgrst, 'reload schema';
