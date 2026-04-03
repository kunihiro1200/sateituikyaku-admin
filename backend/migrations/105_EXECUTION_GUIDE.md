# Migration 105: Migrate visit_date to TIMESTAMP - 実行ガイド

## 概要

このマイグレーションは、`sellers`テーブルの`visit_date`（DATE型）と`visit_time`（VARCHAR型）を統合し、`visit_date`（TIMESTAMP型）に変更します。

## 変更内容

### Before（変更前）
```sql
visit_date DATE           -- 訪問日（例: 2026-04-04）
visit_time VARCHAR(20)    -- 訪問時間（例: 10:00）
```

### After（変更後）
```sql
visit_date TIMESTAMP      -- 訪問予定日時（例: 2026-04-04 10:00:00）
```

## 実行手順

### ステップ1: バックアップ（推奨）

```bash
# 本番環境で実行する前に、必ずバックアップを取得してください
```

### ステップ2: マイグレーション実行

```bash
cd backend
npx ts-node migrations/run-105-migration.ts
```

### ステップ3: 検証

マイグレーション実行後、以下を確認してください：

1. **visit_dateがTIMESTAMP型になっているか**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'sellers' AND column_name = 'visit_date';
   ```
   
   期待される結果: `data_type = 'timestamp without time zone'`

2. **visit_timeカラムが削除されているか**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'sellers' AND column_name = 'visit_time';
   ```
   
   期待される結果: 0行（カラムが存在しない）

3. **既存データが正しく移行されているか**
   ```sql
   SELECT seller_number, visit_date 
   FROM sellers 
   WHERE visit_date IS NOT NULL 
   LIMIT 10;
   ```
   
   期待される結果: `visit_date`が`YYYY-MM-DD HH:MM:SS`形式で表示される

4. **AA13729のデータを確認**
   ```sql
   SELECT seller_number, visit_date 
   FROM sellers 
   WHERE seller_number = 'AA13729';
   ```
   
   期待される結果: `visit_date = '2026-04-04 10:00:00'`

## ロールバック

もしマイグレーションに問題がある場合、以下のSQLでロールバックできます：

```sql
-- ロールバック用SQL（実行前にバックアップから復元することを推奨）
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_time VARCHAR(20);
ALTER TABLE sellers ALTER COLUMN visit_date TYPE DATE USING visit_date::date;
```

**注意**: ロールバックすると、時刻情報が失われます。

## 影響範囲

### データベース
- `sellers`テーブルの構造変更
- 既存データの移行

### バックエンド
- `SellerService.supabase.ts`の修正が必要
- `EnhancedAutoSyncService.ts`の修正が必要

### フロントエンド
- `CallModePage.tsx`の修正が必要
- `sellerStatusFilters.ts`の修正が必要

### GAS
- `gas_complete_code.js`の修正が必要

## 次のステップ

マイグレーション完了後、以下のタスクを実行してください：

1. タスク5.2: GAS同期ロジック更新
2. タスク5.3: バックエンドSellerService更新
3. タスク5.4: フロントエンド表示ロジック更新
4. タスク5.5: TypeScript型定義更新

## トラブルシューティング

### エラー: `exec_sql` function does not exist

Supabaseで`exec_sql`関数が存在しない場合、Supabase Studioから直接SQLを実行してください：

1. Supabase Studioを開く
2. SQL Editorを選択
3. `105_migrate_visit_date_to_timestamp.sql`の内容をコピー＆ペースト
4. 実行

### エラー: データ型変換エラー

`visit_time`に不正な形式のデータが含まれている場合、以下のSQLで修正してください：

```sql
-- 不正な形式のvisit_timeをnullに設定
UPDATE sellers
SET visit_time = NULL
WHERE visit_time ~ '^\d{4}/\d{2}/\d{2}$';  -- 日付形式（YYYY/MM/DD）
```

その後、マイグレーションを再実行してください。

## 完了確認

以下の全てが確認できたら、マイグレーション完了です：

- [ ] `visit_date`がTIMESTAMP型になっている
- [ ] `visit_time`カラムが削除されている
- [ ] 既存データが正しく移行されている（日付と時刻が結合されている）
- [ ] AA13729のデータが`2026-04-04 10:00:00`になっている
- [ ] インデックスが再作成されている

---

**最終更新日**: 2026年4月3日
**作成者**: Kiro
