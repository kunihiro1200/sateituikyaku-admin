-- Migration 20261015: マンション外部建物情報テーブルを作成
-- 通話モードページのマンション種別に表示する「外部建物情報」セクション用
-- 取得元: Jina AI Search + Claude API による Web 情報取得

CREATE TABLE IF NOT EXISTS seller_apartment_building_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_number TEXT NOT NULL,

  -- 建物基本情報（外部取得値）
  building_name         TEXT,          -- マンション名
  management_company    TEXT,          -- 管理会社
  built_year_month      VARCHAR(7),    -- 築年月（YYYY-MM形式）
  total_floors_above    INTEGER,       -- 地上階数
  total_floors_below    INTEGER,       -- 地下階数（通常0）
  total_units           INTEGER,       -- 総戸数
  structure             TEXT,          -- 建物構造（RC造 / SRC造 / S造 等）
  developer_company     TEXT,          -- 分譲会社
  construction_company  TEXT,          -- 施工会社
  management_type       TEXT,          -- 管理形態（全部委託 / 一部委託 / 自主管理）
  has_elevator          TEXT,          -- エレベーター（'あり'/'なし'/null=不明）
  large_repair_history  TEXT,          -- 大規模修繕履歴（テキスト）

  -- 取得メタデータ
  data_source           TEXT,          -- 取得元URL or サイト名
  fetched_at            TIMESTAMPTZ,   -- 最終取得日時
  fetch_error           TEXT,          -- 取得エラーメッセージ

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT seller_apartment_building_info_seller_number_key UNIQUE (seller_number)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_seller_apartment_building_info_seller_number
  ON seller_apartment_building_info (seller_number);

CREATE INDEX IF NOT EXISTS idx_seller_apartment_building_info_fetched_at
  ON seller_apartment_building_info (fetched_at);

-- RLS: service_role は全操作可能（frontend からは直接アクセスしない）
ALTER TABLE seller_apartment_building_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_seller_apartment_building_info"
  ON seller_apartment_building_info
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_seller_apartment_building_info_updated_at
  ON seller_apartment_building_info;

CREATE TRIGGER update_seller_apartment_building_info_updated_at
  BEFORE UPDATE ON seller_apartment_building_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE seller_apartment_building_info IS
  '売主物件（マンション）の外部建物情報（Jina AI Search + Claude API で Web より自動取得）';

COMMENT ON COLUMN seller_apartment_building_info.built_year_month IS
  '築年月: YYYY-MM 形式（例: 1998-03）';
COMMENT ON COLUMN seller_apartment_building_info.has_elevator IS
  'エレベーター有無: "あり" / "なし" / null（不明）';
COMMENT ON COLUMN seller_apartment_building_info.large_repair_history IS
  '大規模修繕履歴: 取得できた場合はテキスト形式で保存（例: "2012年実施"）';
COMMENT ON COLUMN seller_apartment_building_info.data_source IS
  '情報取得元のURL（SUUMO・マンションノート等）';
