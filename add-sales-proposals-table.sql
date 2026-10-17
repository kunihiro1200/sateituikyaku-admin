-- ============================================================
-- 販売提案書保存テーブル (sales_proposals)
-- ============================================================
-- 目的: スタッフが作成した販売提案書の入力内容と生成指示文を保存する
-- 利用: 販売提案書作成モーダル（通話モードページ > 資料生成 > 販売提案書作成）
-- 実行: Supabase ダッシュボード > SQL Editor で1回だけ実行する
--
-- RLS方針: 既存テーブル（sellers/buyers/employees等）と同一の方式を採用
--   - anon/authenticatedロールからの直接アクセスを遮断
--   - バックエンドAPIのSUPABASE_SERVICE_KEY（service_role）のみ許可
--   - service_roleはRLSを自動バイパスするため動作上は不要だが、
--     設計意図を記録するためポリシーを明示的に追加する
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_proposals (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 売主情報
  seller_id              UUID,                           -- sellers.id（外部キー・任意）
  seller_number          TEXT        NOT NULL,           -- 例: FI1260 / AA13501

  -- スタッフ入力内容
  market_price           TEXT,                           -- 相場価格
  challenge_price        TEXT,                           -- チャレンジ価格
  proposed_listing_price TEXT,                           -- 提案売出価格
  target_buyers          TEXT,                           -- 想定購入ターゲット
  other_instructions     TEXT,                           -- その他の指示

  -- 自動取得情報（学校・交通）
  school_info            TEXT,                           -- 小学校・中学校情報
  transit_info           TEXT,                           -- 駅・バス停情報

  -- 生成された指示文（ChatGPT向け）
  generated_prompt       TEXT,

  -- 作成者・タイムスタンプ
  created_by             TEXT,                           -- 担当者名
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─── インデックス ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sales_proposals_seller_id
  ON public.sales_proposals(seller_id);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_seller_number
  ON public.sales_proposals(seller_number);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_created_at
  ON public.sales_proposals(created_at DESC);

-- ─── RLS（Row Level Security）────────────────────────────────────────────────
-- 方針: sellers / buyers / employees / property_inquiries 等と統一
--   バックエンドAPI（SUPABASE_SERVICE_KEY = service_role）のみがアクセス可能。
--   ブラウザから Supabase クライアントライブラリで直接アクセスすることを防ぐ。

-- 1. RLSを有効化
ALTER TABLE public.sales_proposals ENABLE ROW LEVEL SECURITY;

-- 2. service_role のみを許可するポリシーを追加
--    （service_role は RLS を自動バイパスするためポリシーがなくても動作するが、
--      設計意図の明示的な記録として追加する）
CREATE POLICY "backend_service_role_only"
ON public.sales_proposals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ─── コメント ────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sales_proposals
  IS '販売提案書作成モーダルで生成した指示文と入力内容の保存テーブル（バックエンドAPI専用）';

COMMENT ON COLUMN public.sales_proposals.seller_number
  IS '売主番号（FI/AA等のプレフィックスで会社を識別）';

COMMENT ON COLUMN public.sales_proposals.generated_prompt
  IS 'ChatGPT に貼り付ける完全な指示文（A4縦の提案書画像を生成させるため）';

-- ─── 実行後の確認クエリ（Supabase SQL Editor で別途実行） ──────────────────────
--
-- -- 1. テーブルが作成されているか
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'sales_proposals';
-- -- 期待値: 1行、rowsecurity = true
--
-- -- 2. ポリシーが1件のみか
-- SELECT policyname, roles, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'sales_proposals';
-- -- 期待値: 1行、policyname = 'backend_service_role_only', roles = '{service_role}'
--
-- ─── ロールバック手順（問題発生時） ─────────────────────────────────────────────
--
-- DROP TABLE IF EXISTS public.sales_proposals CASCADE;
--
