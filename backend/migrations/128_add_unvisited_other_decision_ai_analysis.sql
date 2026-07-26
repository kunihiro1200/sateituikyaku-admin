-- ============================================================================
-- 128 未訪問他決AI分析結果を保存するカラムを追加
-- JSON文字列で保存: {"summary":"...", "whyLost":"...", "countermeasure":"..."}
-- ============================================================================

ALTER TABLE sellers ADD COLUMN IF NOT EXISTS unvisited_other_decision_ai_analysis TEXT;

DO $$
BEGIN
  RAISE NOTICE '✅ 128: unvisited_other_decision_ai_analysis カラムを追加しました';
END $$;
