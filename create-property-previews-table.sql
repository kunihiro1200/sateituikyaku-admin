-- 他社物件プレビューテーブル
-- スクレイピング結果を保存し、公開URLで買主に共有するためのテーブル

CREATE TABLE IF NOT EXISTS property_previews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- 公開URL用のランダム文字列
  source_url TEXT NOT NULL,            -- 元のathome等のURL
  title TEXT,                          -- 物件タイトル
  price TEXT,                          -- 価格
  address TEXT,                        -- 住所
  access TEXT,                         -- 交通アクセス
  layout TEXT,                         -- 間取り
  area TEXT,                           -- 専有面積
  floor TEXT,                          -- 階建/階
  built_year TEXT,                     -- 築年月
  parking TEXT,                        -- 駐車場
  features TEXT,                       -- 設備・サービス
  remarks TEXT,                        -- 備考
  images JSONB DEFAULT '[]'::jsonb,    -- 画像URL配列
  lat DOUBLE PRECISION,                -- 緯度
  lng DOUBLE PRECISION,                -- 経度
  details JSONB DEFAULT '{}'::jsonb,   -- その他詳細情報
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')  -- 90日後に期限切れ
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_property_previews_slug ON property_previews(slug);
CREATE INDEX IF NOT EXISTS idx_property_previews_created_at ON property_previews(created_at);

-- RLS（Row Level Security）: 公開読み取り可能
ALTER TABLE property_previews ENABLE ROW LEVEL SECURITY;

-- 誰でも読み取り可能（買主がURLでアクセスできるように）
CREATE POLICY "Public read access" ON property_previews
  FOR SELECT USING (true);

-- 認証済みユーザーのみ作成・更新可能
CREATE POLICY "Authenticated insert" ON property_previews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated update" ON property_previews
  FOR UPDATE USING (true);
