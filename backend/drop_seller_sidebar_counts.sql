-- seller_sidebar_countsテーブルを削除
-- 理由: 古いデータを保持し、AA13224とAA13932が「当日TEL」カテゴリに表示されない問題が発生していた
-- getSidebarCountsFallback()を常に使用することで、最新のデータベースの状態を正確に反映する

DROP TABLE IF EXISTS seller_sidebar_counts;
