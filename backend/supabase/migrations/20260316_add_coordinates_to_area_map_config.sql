-- area_map_config テーブルに coordinates カラムを追加
-- 座標をDBにキャッシュすることで、毎回URLから抽出する必要をなくす

ALTER TABLE area_map_config
ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;

COMMENT ON COLUMN area_map_config.coordinates IS 'Google Map URLから抽出した座標 {lat: number, lng: number}';
