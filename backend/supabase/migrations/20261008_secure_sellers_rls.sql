-- ============================================================================
-- Migration: sellers テーブル RLS セキュリティ強化
-- 作成日: 2026-10-08
-- 目的: anon/authenticated ロールからの直接アクセスを遮断する
--
-- 背景:
--   - Migration 093 で authenticated ユーザーへの全CRUD ポリシーが追加された
--   - Migration 094 で RLS が一時無効化された（現在もこの状態）
--   - RLS が無効のため Supabase セキュリティ警告が発生している
--   - 現在のアプリは全アクセスが SUPABASE_SERVICE_KEY (service_role) 経由のため
--     RLS を有効化しても既存機能への影響はない
--
-- 変更内容:
--   1. 過去のマイグレーション(092/093)で作成された全ポリシーを削除
--   2. RLS を有効化
--   3. service_role のみ許可するポリシーを追加
--      （service_role は RLS を自動バイパスするため動作上は不要だが、
--        設計意図の記録として追加する）
--
-- 影響確認:
--   ✅ 売主リスト表示 (GET /api/sellers)      → service_role 経由 → 影響なし
--   ✅ 売主登録 (POST /api/sellers)            → service_role 経由 → 影響なし
--   ✅ 売主更新 (PUT /api/sellers/:id)         → service_role 経由 → 影響なし
--   ✅ 売主削除 (DELETE /api/sellers/:id)      → service_role 経由 → 影響なし
--   ✅ Google Sheets 同期 (sync-cron)          → service_role 経由 → 影響なし
--   ✅ スケジュールチャット送信 (GitHub Actions) → service_role 経由 → 影響なし
--   ❌ anon/authenticated による直接アクセス    → 遮断される（意図通り）
--
-- ロールバック手順:
--   本ファイル末尾の「ROLLBACK」セクションを参照
-- ============================================================================

-- ============================================================================
-- Step 1: 既存ポリシーを全削除
-- IF EXISTS を使用するため、存在しないポリシー名は安全にスキップされる
-- ============================================================================

-- Migration 092 で作成されたポリシー
DROP POLICY IF EXISTS "Service role has full access to sellers"   ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can read sellers"       ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can update sellers"     ON public.sellers;
DROP POLICY IF EXISTS "Authenticated users can insert sellers"     ON public.sellers;

-- Migration 093 で作成されたポリシー
DROP POLICY IF EXISTS "Enable all access for service role"         ON public.sellers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sellers;
DROP POLICY IF EXISTS "Enable insert for authenticated users"      ON public.sellers;
DROP POLICY IF EXISTS "Enable update for authenticated users"      ON public.sellers;
DROP POLICY IF EXISTS "Enable delete for authenticated users"      ON public.sellers;

-- ============================================================================
-- Step 2: RLS を有効化
-- すでに有効な場合でも安全に実行できる
-- ============================================================================

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 3: service_role のみを明示するポリシーを追加
-- ※ service_role は RLS を自動バイパスするためポリシーがなくても動作するが、
--    「バックエンドAPIのみからアクセスする」という設計意図を記録するために追加
-- ============================================================================

CREATE POLICY "backend_service_role_only"
ON public.sellers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 確認用クエリ（実行後に Supabase SQL Editor で別途実行してください）
-- ============================================================================
--
-- -- 1. ポリシーが1件（backend_service_role_only）だけ残っているか確認
-- SELECT policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'sellers'
-- ORDER BY policyname;
--
-- -- 2. RLS が有効になっているか確認（rowsecurity = true）
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'sellers';
--
-- ============================================================================
-- ROLLBACK（問題が発生した場合は以下を Supabase SQL Editor で実行）
-- ============================================================================
--
-- -- RLS を無効化して元の状態（Migration 094 の状態）に戻す
-- ALTER TABLE public.sellers DISABLE ROW LEVEL SECURITY;
--
-- -- 上記だけで既存アプリは即座に動作を再開する（service_role はポリシー不要）
-- -- ポリシーは削除済みのため、次回有効化時には本マイグレーションの再実行が必要
--
-- ============================================================================
