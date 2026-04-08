# seller_sidebar_counts テーブル作成ガイド

## 概要

`seller_sidebar_counts`テーブルを作成し、サイドバーカウントを事前計算することで、APIレスポンス時間を3秒→0.1-0.2秒に改善します。

## 手順

### 1. Supabase Studioでマイグレーションを実行

1. **Supabase Studioを開く**
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/editor

2. **SQL Editorを開く**
   - 左メニューから「SQL Editor」をクリック

3. **マイグレーションSQLを実行**
   - `backend/supabase/migrations/20260409000000_create_seller_sidebar_counts.sql`の内容をコピー
   - SQL Editorに貼り付け
   - 「Run」ボタンをクリック

4. **実行結果を確認**
   - エラーがないことを確認
   - 「Success. No rows returned」と表示されればOK

### 2. テーブルが作成されたことを確認

```sql
-- seller_sidebar_countsテーブルを確認
SELECT * FROM seller_sidebar_counts LIMIT 10;

-- テーブル構造を確認
\d seller_sidebar_counts
```

### 3. 初回データ投入

バックエンドサーバーを起動して、以下のエンドポイントを呼び出します：

```bash
# ローカル環境
curl -X POST http://localhost:3000/api/sellers/sidebar-counts/update \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 本番環境
curl -X POST https://sateituikyaku-admin-backend.vercel.app/api/sellers/sidebar-counts/update \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**注意**: `CRON_SECRET`環境変数を設定していない場合は、`-H "Authorization: Bearer YOUR_CRON_SECRET"`を省略してください。

### 4. データが投入されたことを確認

```sql
-- seller_sidebar_countsテーブルのデータを確認
SELECT category, count, label, assignee, updated_at
FROM seller_sidebar_counts
ORDER BY category, assignee, label;

-- カテゴリ別のカウント数を確認
SELECT category, SUM(count) as total_count
FROM seller_sidebar_counts
GROUP BY category
ORDER BY category;
```

### 5. Vercel Cronの設定（本番環境のみ）

1. **Vercelダッシュボードを開く**
   - URL: https://vercel.com/kunihiro1200s-projects/backend

2. **Cronジョブを確認**
   - 「Cron Jobs」タブをクリック
   - `/api/sellers/sidebar-counts/update`が10分ごとに実行されることを確認

3. **環境変数を設定**（オプション）
   - 「Settings」→「Environment Variables」
   - `CRON_SECRET`を追加（セキュリティ強化のため）

### 6. 動作確認

1. **APIレスポンス時間を確認**
   ```bash
   # 本番環境
   time curl https://sateituikyaku-admin-backend.vercel.app/api/sellers/sidebar-counts
   ```

   **期待される結果**: 0.1-0.2秒以内

2. **ブラウザで確認**
   - 売主リストページを開く
   - サイドバーが即座に表示されることを確認
   - ネットワークタブで`/api/sellers/sidebar-counts`のレスポンス時間を確認

## トラブルシューティング

### 問題1: テーブルが空のまま

**原因**: 初回データ投入が実行されていない

**解決策**:
```bash
curl -X POST https://sateituikyaku-admin-backend.vercel.app/api/sellers/sidebar-counts/update
```

### 問題2: APIレスポンスが遅い（3秒以上）

**原因**: `seller_sidebar_counts`テーブルが空のため、フォールバック（重いクエリ）が実行されている

**解決策**:
1. テーブルにデータが投入されているか確認
2. 初回データ投入を実行

### 問題3: Cronジョブが実行されない

**原因**: `vercel.json`が正しく設定されていない

**解決策**:
1. `backend/vercel.json`を確認
2. Vercelダッシュボードで「Cron Jobs」タブを確認
3. 手動でエンドポイントを呼び出してテスト

## パフォーマンス比較

| 実装 | APIレスポンス時間 | 改善率 |
|------|------------------|--------|
| 修正前（フォールバックのみ） | 7.68秒 | - |
| Task 5.1+5.2（インデックス+並列化） | 658ms | 91% |
| Task 5.5（seller_sidebar_countsテーブル） | 0.1-0.2秒 | 99% |

## まとめ

`seller_sidebar_counts`テーブルを導入することで、サイドバーカウントのAPIレスポンス時間を劇的に改善できます（3秒→0.1-0.2秒）。

買主リストでは同じアプローチを採用しており、非常に高速に動作しています。
