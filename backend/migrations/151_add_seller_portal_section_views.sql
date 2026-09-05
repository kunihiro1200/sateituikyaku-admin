-- Migration: 151_add_seller_portal_section_views
-- Description: 売却サポートページの「全体分析」（セクション別アクセス数・PWA保存クリック数・
--   福岡/大分別の統計）を集計できるようにするため、セクション単位のアクセスログを追加する。
--   既存の seller_portal_preferences.viewed_rough_proceeds_at 等は「初回閲覧の1回分」しか
--   記録できず、閲覧回数の集計や新セクション（valuation, valuation_breakdown, schedule）の
--   アクセス数を出せないため、都度INSERTするログテーブルとして別途用意する。
-- Created: 2026-09-06
-- 関連: backend/src/services/SellerPortalService.ts, backend/src/routes/sellerPortal.ts

CREATE TABLE IF NOT EXISTS seller_portal_section_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  seller_number VARCHAR(20) NOT NULL,
  -- 既存の context_tag（チャットの相談元）と命名を揃える。'pwa_install' はホーム画面保存の
  -- ボタン押下（InstallPwaBanner/Prompt→InstallPwaGuideDialogを開いた操作）を記録する。
  section VARCHAR(30) NOT NULL CHECK (
    section IN ('valuation', 'valuation_breakdown', 'net_proceeds_rough', 'net_proceeds_detailed', 'schedule', 'pwa_install')
  ),
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_portal_section_views_seller_id ON seller_portal_section_views(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_portal_section_views_seller_number ON seller_portal_section_views(seller_number);
CREATE INDEX IF NOT EXISTS idx_seller_portal_section_views_section ON seller_portal_section_views(section);
CREATE INDEX IF NOT EXISTS idx_seller_portal_section_views_viewed_at ON seller_portal_section_views(viewed_at);

COMMENT ON TABLE seller_portal_section_views IS '売却サポートページ：セクション別アクセスログ（全体分析ダッシュボード集計用）。1回のアクセスにつき1行INSERTする（回数を数えるため上書きしない）';
COMMENT ON COLUMN seller_portal_section_views.section IS 'valuation=査定額 / valuation_breakdown=査定根拠 / net_proceeds_rough=ざっくり手残り / net_proceeds_detailed=詳細手残り / schedule=売却スケジュール / pwa_install=ホーム画面保存ボタン押下';
