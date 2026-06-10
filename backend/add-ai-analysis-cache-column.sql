-- exclusive_analysis_qa テーブルに AI分析キャッシュカラムを追加
-- ページを開くたびにAI APIを呼び出さないようにするため

ALTER TABLE exclusive_analysis_qa
  ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
