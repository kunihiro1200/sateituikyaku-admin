-- seller_sidebar_countsテーブルに専任・一般・訪問後他決カテゴリーを追加
-- 初期値は0に設定（GASの次回同期で正しい値に更新される）
-- 主キー: id (uuid)
-- ユニーク制約: category + label + assignee の組み合わせ

-- 既存レコードを削除（存在する場合）
DELETE FROM seller_sidebar_counts
WHERE category IN ('exclusive', 'general', 'visitOtherDecision')
  AND label IS NULL
  AND assignee IS NULL;

-- 新規レコードを挿入
INSERT INTO seller_sidebar_counts (category, count, label, assignee, updated_at)
VALUES 
  ('exclusive', 0, NULL, NULL, NOW()),
  ('general', 0, NULL, NULL, NOW()),
  ('visitOtherDecision', 0, NULL, NULL, NOW());

-- 確認クエリ
SELECT category, count, label, assignee, updated_at
FROM seller_sidebar_counts
WHERE category IN ('exclusive', 'general', 'visitOtherDecision')
ORDER BY category;
