-- AI分析キャッシュをリセット（プロンプト変更後に再生成させるため）
-- 「1番電話・初動の速さ」を除外したプロンプトで再生成する

UPDATE exclusive_analysis_qa
SET ai_analysis = NULL,
    updated_at = now()
WHERE ai_analysis IS NOT NULL;
