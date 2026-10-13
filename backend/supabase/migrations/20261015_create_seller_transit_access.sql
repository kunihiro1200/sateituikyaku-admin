-- Migration 20261015: 売主物件の交通アクセス情報テーブル
-- Google Maps Places API（旧版 nearbysearch）で自動取得した最寄り駅・バス停情報を保存する
--
-- 利用規約: Google Maps Platform では取得データのキャッシュ（DB保存）を許可。
--           場所データは30日以内の再表示用途に限り許容される（fetched_at で管理）。
-- 新版移行: 将来的に New Places API に移行する場合は backend/src/routes/transitAccess.ts の
--           callOldPlacesNearbysearch() 関数のみを差し替えること。

CREATE TABLE IF NOT EXISTS seller_transit_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_number TEXT NOT NULL,

  -- 店舗判定（seller_number の FI判定による）
  -- fukuoka = seller_number に "fi" を含む（大文字小文字不問）
  -- oita    = seller_number に "fi" を含まない
  -- unknown = seller_number が未設定
  store_type TEXT NOT NULL CHECK (store_type IN ('fukuoka', 'oita', 'unknown')),

  -- 交通機関種別・順位
  transport_type TEXT NOT NULL CHECK (transport_type IN ('station', 'bus_stop')),
  rank INTEGER NOT NULL CHECK (rank >= 1),  -- 1始まり。福岡最大3、大分最大1

  -- 施設情報（Google Maps Places API 取得値）
  name TEXT,           -- 駅名またはバス停名
  line_name TEXT,      -- 路線名またはバス運行事業者名（Places API から取得不可のため手動補完）

  -- 距離情報
  walk_distance_m INTEGER,            -- 徒歩道路距離（m）Directions API 実測値
  walk_minutes INTEGER,               -- 広告用徒歩分数（walk_distance_m / 80 切り上げ）
  is_estimated_distance BOOLEAN NOT NULL DEFAULT false,
    -- true = Directions API 失敗 → 直線距離 × 1.3 の推定値を使用

  -- Google Maps 位置情報（将来の確認・修正用）
  place_id TEXT,              -- Google Maps place_id
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,

  -- 広告掲載候補の選択状態（再取得時に上書きしない）
  is_selected BOOLEAN NOT NULL DEFAULT false,

  -- 手動修正（再取得時に上書きしない）
  is_manually_corrected BOOLEAN NOT NULL DEFAULT false,
  manual_name TEXT,
  manual_line_name TEXT,
  manual_walk_minutes INTEGER,

  -- 確認状況
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,

  -- メタデータ
  data_source TEXT NOT NULL DEFAULT 'Google Maps Places API',
  fetched_at TIMESTAMPTZ,
  fetch_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- seller_number + 種別 + 順位 の組み合わせはユニーク（再取得時に upsert 可能）
  UNIQUE (seller_number, transport_type, rank)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_seller_transit_access_seller_number
  ON seller_transit_access (seller_number);

CREATE INDEX IF NOT EXISTS idx_seller_transit_access_fetched_at
  ON seller_transit_access (fetched_at);

-- RLS: service_role は全操作可能（フロントエンドからは直接アクセスしない）
ALTER TABLE seller_transit_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_seller_transit_access" ON seller_transit_access
  FOR ALL USING (true) WITH CHECK (true);

-- コメント
COMMENT ON TABLE seller_transit_access IS
  '売主物件の最寄り駅・バス停情報（Google Maps Places API / Directions API より自動取得）';

COMMENT ON COLUMN seller_transit_access.store_type IS
  '店舗判定: fukuoka=FIを含む売主番号, oita=FIを含まない, unknown=売主番号未設定';

COMMENT ON COLUMN seller_transit_access.transport_type IS
  '交通機関種別: station=駅, bus_stop=バス停';

COMMENT ON COLUMN seller_transit_access.rank IS
  '道路距離が短い順の順位（1始まり）。福岡店は最大3件、大分店は最大1件';

COMMENT ON COLUMN seller_transit_access.is_estimated_distance IS
  'true = Directions API 失敗のため直線距離 × 1.3 の推定値を使用（広告掲載前に要確認）';

COMMENT ON COLUMN seller_transit_access.is_selected IS
  '広告掲載候補として選択中か否か。再取得時に上書きしない。';

COMMENT ON COLUMN seller_transit_access.is_manually_corrected IS
  'ユーザーが手動修正を行った場合 true。再取得時に上書きしない。';

COMMENT ON COLUMN seller_transit_access.line_name IS
  '路線名またはバス運行事業者名。Google Maps Places API からは取得できないため手動入力が必要。';
