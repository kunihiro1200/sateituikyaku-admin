-- Rollback: 145_add_consult_app_tables の取り消し
-- 相談チャットアプリの方針を撤回し、「売却サポートページ」構想に切り替えるため、
-- 未使用のテーブル4つを削除する。実運用データはまだ存在しない（テスト1件のみ）ため影響は無い想定。
-- 実行前に念のため consult_sessions / consult_user_profile / consult_conversations / consult_messages
-- の行数を確認してから実行することを推奨します。
-- Created: 2026-09-03

DROP TRIGGER IF EXISTS trigger_consult_user_profile_updated_at ON consult_user_profile;
DROP FUNCTION IF EXISTS update_consult_user_profile_updated_at();

DROP TABLE IF EXISTS consult_messages;
DROP TABLE IF EXISTS consult_conversations;
DROP TABLE IF EXISTS consult_user_profile;
DROP TABLE IF EXISTS consult_sessions;
