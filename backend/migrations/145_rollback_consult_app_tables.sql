-- Rollback: 145_add_consult_app_tables の取り消し
-- 相談チャットアプリの方針を撤回し、「売却サポートページ」構想に切り替えるため、
-- 未使用のテーブル4つを削除する。実運用データはまだ存在しない（テスト1件のみ）ため影響は無い想定。
-- Created: 2026-09-03
-- 修正: DROP TABLE すれば紐づくトリガーも自動的に削除されるため、個別の DROP TRIGGER は不要
--       （逆に対象テーブルが既に存在しない場合、DROP TRIGGER ... ON <table> はテーブル不在で
--        エラーになってしまうため、この版では削除した。CASCADEでトリガー依存も含めて安全に処理する）

DROP FUNCTION IF EXISTS update_consult_user_profile_updated_at() CASCADE;

DROP TABLE IF EXISTS consult_messages;
DROP TABLE IF EXISTS consult_conversations;
DROP TABLE IF EXISTS consult_user_profile;
DROP TABLE IF EXISTS consult_sessions;
