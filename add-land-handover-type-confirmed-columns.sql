-- 業務依頼（work_tasks）に「解体更地渡しか現況渡しか確認したか」カラムを追加
--
-- 種別が「土地（土）」のときに使用する確認項目。
--  1) land_handover_type_confirmed       : サイト登録依頼セクション（格納先URLの上）に表示する確認（Y/N）。
--     ⚠️ ここが 'Y'（確認済）にならないと CWの方へサイト登録依頼メールを送信しない。
--  2) land_handover_type_confirmed_check : サイト登録確認セクション（写真の順番確認の下）に表示する確認（済/未）。
--
-- Supabase ダッシュボードの SQL Editor で以下を実行して本番DBに適用すること。
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS land_handover_type_confirmed TEXT;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS land_handover_type_confirmed_check TEXT;

COMMENT ON COLUMN work_tasks.land_handover_type_confirmed IS '解体更地渡しか現況渡しか確認したか（サイト登録依頼／Y/N）。土地のみ。Y でないとCWサイト登録依頼メールを送らない';
COMMENT ON COLUMN work_tasks.land_handover_type_confirmed_check IS '解体更地渡しか現況渡しか確認したか（サイト登録確認／済・未）。土地のみ';
