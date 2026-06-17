-- メール処理済みIDをSupabaseに永続保存するテーブル
-- Railwayが再起動しても処理済みIDが消えないようにする

CREATE TABLE IF NOT EXISTS mail_processed_ids (
  id SERIAL PRIMARY KEY,
  mail_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 古いレコードを自動削除するインデックス（7日以上前のものは不要）
CREATE INDEX IF NOT EXISTS idx_mail_processed_ids_created_at 
  ON mail_processed_ids (created_at);

-- RLS無効（サービスキーのみでアクセス）
ALTER TABLE mail_processed_ids DISABLE ROW LEVEL SECURITY;
