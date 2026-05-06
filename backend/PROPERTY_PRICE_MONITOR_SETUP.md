# 建売専門HP 価格変動監視機能 セットアップガイド

## 概要

買主リストの「建売専門HP」に設定されたURLを毎日スクレイピングし、価格変動（値下げ・値上げ・売却済み・削除）を検知してメール通知する機能です。

## 機能

- ✅ 毎日午前9時に自動実行
- ✅ 全買主の建売専門HPをチェック
- ✅ 価格変動を検知（値下げ・値上げ・売却済み・削除）
- ✅ `tenant@ifoo-oita.com` にメール通知
- ✅ 価格履歴をデータベースに保存

## セットアップ手順

### 1. データベースマイグレーション

```bash
# マイグレーションを実行
cd backend
npm run migrate

# または手動でSQLを実行
psql $DATABASE_URL < supabase/migrations/20260506_add_property_price_history.sql
```

### 2. 環境変数の設定

Vercelの環境変数に以下を追加：

```bash
# Cron Job認証用のシークレット（ランダムな文字列を生成）
CRON_SECRET=your-random-secret-here

# スクレイピングサーバーのURL（既に設定済みの場合はスキップ）
SCRAPING_SERVER_URL=https://sateituikyaku-scrape-server-production.up.railway.app
```

**CRON_SECRETの生成方法**:
```bash
# ランダムな文字列を生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Vercelにデプロイ

```bash
cd backend
vercel --prod
```

### 4. Cron Jobの確認

Vercelダッシュボードで以下を確認：

1. **Settings** → **Cron Jobs** に移動
2. `/api/cron/check-property-prices` が表示されていることを確認
3. スケジュール: `0 9 * * *`（毎日午前9時 UTC = 日本時間18時）

**⚠️ 注意**: Vercel Cron JobsはUTCで動作します。日本時間午前9時に実行したい場合は `0 0 * * *`（UTC午前0時 = JST午前9時）に設定してください。

### 5. 手動テスト

Cron Jobを手動でテストする場合：

```bash
# ローカルでテスト
curl -X POST http://localhost:3000/api/cron/check-property-prices \
  -H "Authorization: Bearer your-cron-secret"

# 本番環境でテスト
curl -X POST https://your-backend.vercel.app/api/cron/check-property-prices \
  -H "Authorization: Bearer your-cron-secret"
```

## 使い方

### 買主に建売専門HPを設定

1. 買主詳細ページを開く
2. 「建売専門HP」フィールドにURLを入力
3. 保存

例: `https://www.tateuri-senmon.com/property/12345`

### 価格変動の確認

毎日午前9時に自動的にチェックされ、変動があれば `tenant@ifoo-oita.com` にメールが届きます。

**メール例**:
```
件名: 【価格変動通知】建売専門HP 価格変動 2件

建売専門HPの価格変動をお知らせします。

変更件数: 2件
============================================================

買主名: 山田太郎
物件URL: https://www.tateuri-senmon.com/property/12345
変更内容: 値下げ 🔽
前回価格: 39,800,000円
現在価格: 37,800,000円
値下げ額: 2,000,000円 (-5.0%)

------------------------------------------------------------

買主名: 佐藤花子
物件URL: https://www.tateuri-senmon.com/property/67890
変更内容: 売却済み ✅
最終価格: 42,000,000円

------------------------------------------------------------

※このメールは自動送信されています。
```

## トラブルシューティング

### メールが届かない

1. Vercel Logsで実行ログを確認
2. `CRON_SECRET` が正しく設定されているか確認
3. EmailServiceが正しく動作しているか確認

### スクレイピングエラー

1. スクレイピングサーバー（Railway）が起動しているか確認
2. `SCRAPING_SERVER_URL` が正しく設定されているか確認
3. 物件URLが正しいか確認

### 価格が取得できない

スクレイピングサーバーの価格取得ロジックを確認してください。
現在は以下のパターンに対応：
- `3,980万円` → 39,800,000円
- `39,800,000円` → 39,800,000円

## データベーステーブル

### property_price_history

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| buyer_id | UUID | 買主ID |
| property_url | TEXT | 物件URL |
| price | BIGINT | 価格（円） |
| status | TEXT | ステータス（available/sold/deleted） |
| scraped_at | TIMESTAMP | スクレイピング実行日時 |
| created_at | TIMESTAMP | 作成日時 |

## 今後の拡張案

- [ ] 通知先を複数設定可能にする
- [ ] 通知タイミングをカスタマイズ可能にする
- [ ] 価格変動のグラフ表示
- [ ] 特定の買主のみ監視対象にする
- [ ] SMS通知にも対応

---

**作成日**: 2026年5月6日
**作成者**: KIRO
