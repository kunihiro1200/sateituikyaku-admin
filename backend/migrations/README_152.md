# Migration 152: 営業会議の各担当者回答公開機能

## 概要

営業会議の「物件数チーム」「契約率チーム」の共有詳細ページにおいて、各担当者が自分のコメントを入力し、会議中に自分のタイミングで「公開」ボタンを押して他のメンバーに見せる機能を追加します。

## 背景

従来は全員のコメントが常に表示されていたため、国広が最初にコメントを入力すると、他のスタッフが国広のコメントに引きずられて似たようなコメントを入力してしまう問題がありました。

この機能により、各スタッフは他人のコメントを見る前に自分の意見を準備でき、会議の時に全員が準備できたタイミングで公開できるようになります。

## DB変更内容

`shared_item_team_answers` テーブルに以下のカラムを追加：

- `is_kunihiro_visible` BOOLEAN DEFAULT FALSE - 国広の回答が公開されているか
- `is_yamamoto_visible` BOOLEAN DEFAULT FALSE - 山本の回答が公開されているか
- `is_ura_visible` BOOLEAN DEFAULT FALSE - 裏の回答が公開されているか
- `is_kadoi_visible` BOOLEAN DEFAULT FALSE - 角井の回答が公開されているか
- `is_hayashida_visible` BOOLEAN DEFAULT FALSE - 林田の回答が公開されているか
- `is_aso_visible` BOOLEAN DEFAULT FALSE - 麻生の回答が公開されているか

## マイグレーション実行手順

### 1. SupabaseのSQL Editorを開く

1. Supabaseダッシュボードにログイン
2. 左サイドバーの「SQL Editor」をクリック
3. 「New query」をクリック

### 2. マイグレーションSQLを実行

以下のSQLをコピーして実行してください：

\`\`\`sql
-- 営業会議の物件数チーム・契約率チームの各担当者回答に公開状態フラグを追加
-- 各スタッフが自分のタイミングで「公開」ボタンを押して他のメンバーに見せる機能

ALTER TABLE shared_item_team_answers
ADD COLUMN IF NOT EXISTS is_kunihiro_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_yamamoto_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_ura_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_kadoi_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_hayashida_visible BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_aso_visible BOOLEAN DEFAULT FALSE;

-- 各カラムのコメント
COMMENT ON COLUMN shared_item_team_answers.is_kunihiro_visible IS '国広の回答が公開されているか（TRUE=公開、FALSE=非公開）';
COMMENT ON COLUMN shared_item_team_answers.is_yamamoto_visible IS '山本の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_ura_visible IS '裏の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_kadoi_visible IS '角井の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_hayashida_visible IS '林田の回答が公開されているか';
COMMENT ON COLUMN shared_item_team_answers.is_aso_visible IS '麻生の回答が公開されているか';
\`\`\`

### 3. 実行結果を確認

実行が成功すると、以下のように表示されます：

```
Success. No rows returned.
```

### 4. 確認クエリ

テーブル構造を確認するには：

\`\`\`sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shared_item_team_answers'
ORDER BY ordinal_position;
\`\`\`

## 動作確認

1. 営業会議の「共有」タブを開く
2. 「物件数チーム」または「契約率チーム」のアイテムを選択
3. 各担当者の回答欄を確認
4. 自分の名前の欄にコメントを入力
5. 「公開する」ボタンが表示されることを確認
6. ボタンを押して公開状態に切り替え
7. 他のアカウントでログインして、公開された回答が表示されることを確認
8. 未公開の回答は「未公開」と表示されることを確認

## ロールバック

もしマイグレーションを戻す必要がある場合：

\`\`\`sql
ALTER TABLE shared_item_team_answers
DROP COLUMN IF EXISTS is_kunihiro_visible,
DROP COLUMN IF EXISTS is_yamamoto_visible,
DROP COLUMN IF EXISTS is_ura_visible,
DROP COLUMN IF EXISTS is_kadoi_visible,
DROP COLUMN IF EXISTS is_hayashida_visible,
DROP COLUMN IF EXISTS is_aso_visible;
\`\`\`

## 関連ファイル

- マイグレーションSQL: `backend/migrations/152_add_team_answer_visibility.sql`
- バックエンドAPI: `backend/src/routes/sharedItems.ts`
- フロントエンド: `frontend/frontend/src/pages/SharedItemDetailPage.tsx`

## 作成日

2026年9月7日
