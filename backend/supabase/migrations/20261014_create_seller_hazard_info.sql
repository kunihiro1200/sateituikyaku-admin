-- Migration 20261014: 売主物件のハザード情報テーブルを作成
-- 国土交通省 不動産情報ライブラリAPI（Reinfolib）で自動取得した防災情報を保存する
-- 対応API: XKT026（洪水）XKT027（高潮）XKT028（津波）XKT029（土砂災害）

CREATE TABLE IF NOT EXISTS seller_hazard_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_number TEXT NOT NULL,

  -- 取得時の座標（sellers.latitude/longitude と一致する）
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- ① 洪水浸水想定区域（想定最大規模） XKT026
  -- status: null=未取得 / 'outside'=区域外 / 'inside'=区域内 / 'error'=取得失敗
  flood TEXT,
  flood_depth_rank INTEGER,  -- 1=0.5m未満 2=0.5-3m 3=3-5m 4=5-10m 5=10-20m 6=20m以上
  flood_depth_label TEXT,    -- "0.5m以上3m未満" など
  flood_river_name TEXT,     -- 対象河川名

  -- ② 雨水出水（内水氾濫）
  -- Reinfolib APIに未整備のため 'unavailable' 固定、自治体ハザードマップを確認すること
  inland_flood TEXT NOT NULL DEFAULT 'unavailable',

  -- ③ 高潮浸水想定区域 XKT027
  storm_surge TEXT,
  storm_surge_depth TEXT,    -- "5m以上10m未満" など（API応答そのまま）

  -- ④ 津波浸水想定 XKT028
  tsunami TEXT,
  tsunami_depth TEXT,        -- "3m以上 〜 5m未満" など（API応答そのまま）

  -- ⑤ 土砂災害警戒区域（イエローゾーン） XKT029 A33_002=1
  landslide_yellow TEXT,
  landslide_yellow_type TEXT, -- "急傾斜地の崩壊" / "土石流" / "地すべり"

  -- ⑥ 土砂災害特別警戒区域（レッドゾーン） XKT029 A33_002=2
  landslide_red TEXT,
  landslide_red_type TEXT,

  -- メタデータ
  fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  data_source TEXT NOT NULL DEFAULT '国土交通省 不動産情報ライブラリ',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT seller_hazard_info_seller_number_key UNIQUE (seller_number)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_seller_hazard_info_seller_number
  ON seller_hazard_info (seller_number);

CREATE INDEX IF NOT EXISTS idx_seller_hazard_info_fetched_at
  ON seller_hazard_info (fetched_at);

-- RLS: service_role は全操作可能（frontend からは直接アクセスしない）
ALTER TABLE seller_hazard_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_seller_hazard_info" ON seller_hazard_info
  FOR ALL USING (true) WITH CHECK (true);

-- コメント
COMMENT ON TABLE seller_hazard_info IS
  '売主物件の防災情報（国土交通省 不動産情報ライブラリAPIより自動取得）';

COMMENT ON COLUMN seller_hazard_info.flood IS
  '洪水浸水想定区域（想定最大規模）: null=未取得 / outside=区域外 / inside=区域内 / error=取得失敗';
COMMENT ON COLUMN seller_hazard_info.flood_depth_rank IS
  '洪水浸水深ランク: 1=0.5m未満 2=0.5-3m 3=3-5m 4=5-10m 5=10-20m 6=20m以上';
COMMENT ON COLUMN seller_hazard_info.inland_flood IS
  '雨水出水（内水氾濫）: Reinfolib未整備のため unavailable 固定。自治体ハザードマップを確認すること';
COMMENT ON COLUMN seller_hazard_info.storm_surge IS
  '高潮浸水想定区域: null=未取得 / outside=区域外 / inside=区域内 / error=取得失敗';
COMMENT ON COLUMN seller_hazard_info.tsunami IS
  '津波浸水想定: null=未取得 / outside=区域外 / inside=区域内 / error=取得失敗';
COMMENT ON COLUMN seller_hazard_info.landslide_yellow IS
  '土砂災害警戒区域（イエローゾーン）: null=未取得 / outside=区域外 / inside=区域内 / error=取得失敗';
COMMENT ON COLUMN seller_hazard_info.landslide_red IS
  '土砂災害特別警戒区域（レッドゾーン）: null=未取得 / outside=区域外 / inside=区域内 / error=取得失敗';
