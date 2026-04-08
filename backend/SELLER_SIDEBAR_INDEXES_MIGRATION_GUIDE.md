# 売主サイドバーインデックス追加マイグレーションガイド

## 目的

`/api/sellers/sidebar-counts`エンドポイントの応答時間を**7-8秒から3-4秒に短縮**する。

## 問題

現在、サイドバーカウント取得時に以下の問題が発生している：

1. **複数のページネーションループ**（各1000件ずつ全件取得）
2. **フルテーブルスキャン**（インデックスがない）
3. **JavaScriptでのフィルタリング**（データベースレベルではない）

## 解決策

頻繁にクエリされるカラムにインデックスを追加する。

## 実行手順

### ステップ1: Supabase SQLエディタを開く

1. Supabaseダッシュボードにログイン
2. プロジェクト「sateituikyaku-admin」を選択
3. 左メニューから「SQL Editor」を選択

### ステップ2: SQLファイルを実行

`backend/add-seller-sidebar-indexes.sql`の内容をコピーして、SQLエディタに貼り付けて実行。

または、以下のコマンドで実行：

```bash
cd backend
npx ts-node apply-seller-sidebar-indexes.ts
```

### ステップ3: インデックス作成を確認

以下のSQLを実行して、インデックスが正しく作成されたか確認：

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'sellers' 
  AND indexname LIKE 'idx_sellers_%'
ORDER BY indexname;
```

**期待される結果**:

| indexname | indexdef |
|-----------|----------|
| idx_sellers_inquiry_date | CREATE INDEX idx_sellers_inquiry_date ON public.sellers USING btree (inquiry_date) WHERE (deleted_at IS NULL) |
| idx_sellers_mailing_status | CREATE INDEX idx_sellers_mailing_status ON public.sellers USING btree (mailing_status) WHERE (deleted_at IS NULL) |
| idx_sellers_next_call_date | CREATE INDEX idx_sellers_next_call_date ON public.sellers USING btree (next_call_date) WHERE (deleted_at IS NULL) |
| idx_sellers_status_gin | CREATE INDEX idx_sellers_status_gin ON public.sellers USING gin (status gin_trgm_ops) |
| idx_sellers_today_call | CREATE INDEX idx_sellers_today_call ON public.sellers USING btree (status, next_call_date, visit_assignee) WHERE (deleted_at IS NULL) |
| idx_sellers_visit_assignee | CREATE INDEX idx_sellers_visit_assignee ON public.sellers USING btree (visit_assignee) WHERE (deleted_at IS NULL) |
| idx_sellers_visit_date | CREATE INDEX idx_sellers_visit_date ON public.sellers USING btree (visit_date) WHERE (deleted_at IS NULL) |

### ステップ4: パフォーマンステスト

1. ブラウザのネットワークタブを開く
2. 売主リストページにアクセス
3. `/api/sellers/sidebar-counts`エンドポイントのレスポンス時間を確認

**目標**: 7-8秒 → 3-4秒

### ステップ5: 結果を記録

パフォーマンステストの結果を記録：

- **修正前**: ___秒
- **修正後**: ___秒
- **改善率**: ___%

## 作成されるインデックス

1. **idx_sellers_visit_assignee**: 営担インデックス
   - 用途: 訪問日前日、訪問済み、当日TEL担当、担当イニシャル親カテゴリ
   
2. **idx_sellers_next_call_date**: 次電日インデックス
   - 用途: 当日TEL分、当日TEL担当
   
3. **idx_sellers_visit_date**: 訪問日インデックス
   - 用途: 訪問日前日、訪問済み
   
4. **idx_sellers_status_gin**: 状況（当社）インデックス（部分一致用）
   - 用途: 全カテゴリ（`status ILIKE '%追客中%'`など）
   
5. **idx_sellers_today_call**: 複合インデックス（当日TEL分用）
   - 用途: 当日TEL分（status + next_call_date + visit_assignee）
   
6. **idx_sellers_inquiry_date**: 反響日付インデックス
   - 用途: 未査定、当日TEL_未着手
   
7. **idx_sellers_mailing_status**: 郵送ステータスインデックス
   - 用途: 査定（郵送）

## トラブルシューティング

### エラー: `extension "pg_trgm" does not exist`

**原因**: pg_trgm拡張がインストールされていない

**解決策**: 以下のSQLを実行

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### エラー: `relation "idx_sellers_xxx" already exists`

**原因**: インデックスが既に存在する

**解決策**: エラーを無視して続行（`IF NOT EXISTS`が機能していない場合）

### パフォーマンスが改善しない

**原因**: インデックスが使用されていない可能性

**確認方法**: クエリの実行計画を確認

```sql
EXPLAIN ANALYZE
SELECT COUNT(*) FROM sellers
WHERE deleted_at IS NULL
  AND visit_assignee IS NOT NULL
  AND visit_assignee != ''
  AND next_call_date <= CURRENT_DATE;
```

**期待される結果**: `Index Scan using idx_sellers_xxx`が表示される

## 次のステップ

インデックス追加後もパフォーマンスが不十分な場合：

1. **タスク5.2**: クエリの並列化（推定: 3-4秒 → 2-3秒）
2. **タスク5.3**: キャッシュTTLの延長（再取得頻度を削減）
3. **タスク5.4**: データベースビューの作成（推定: 2-3秒 → 1秒以下）

## 参考資料

- PostgreSQLインデックスドキュメント: https://www.postgresql.org/docs/current/indexes.html
- pg_trgm拡張: https://www.postgresql.org/docs/current/pgtrgm.html
- Supabase SQLエディタ: https://supabase.com/docs/guides/database/overview

---

**作成日**: 2026年4月9日  
**目的**: 売主サイドバーカウント取得のパフォーマンス改善（7-8秒 → 3-4秒）
