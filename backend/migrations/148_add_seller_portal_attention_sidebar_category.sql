-- Migration: 148_add_seller_portal_attention_sidebar_category
-- Description: サイドバーカテゴリー「売却サポート：対応要」の初期行をseller_sidebar_countsに追加する。
--   実際の件数計算は SellerSidebarCountsUpdateService.updateSellerPortalAttentionCategory() /
--   updateSellerSidebarCounts()（10分ごとのCron）が更新するため、ここでは0件で初期化するだけでよい。
-- Created: 2026-09-03

-- 既存レコードを削除（存在する場合、再実行を安全にするため）
DELETE FROM seller_sidebar_counts
WHERE category = 'sellerPortalAttention'
  AND label IS NULL
  AND assignee IS NULL;

INSERT INTO seller_sidebar_counts (category, count, label, assignee, updated_at)
VALUES
  ('sellerPortalAttention', 0, NULL, NULL, NOW());
