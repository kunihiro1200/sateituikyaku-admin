# 買主カラム同期ルール（絶対に守るべきルール）

## ⚠️ 最重要：買主カラムを追加する際の必須作業

買主テーブル（`buyers`）に新しいカラムを追加する場合、**以下の3箇所を必ず全て更新すること**。

---

## 📋 更新が必要な3箇所

### 1. `backend/src/config/buyer-column-mapping.json`

`spreadsheetToDatabaseExtended` セクションに追加：

```json
"スプシのカラム名": "db_column_name"
```

### 2. GASの `BUYER_COLUMN_MAPPING`（買主リスト同期スクリプト）

スプレッドシートに紐づいたGASプロジェクト内の `BUYER_COLUMN_MAPPING` に追加：

```javascript
'スプシのカラム名': 'db_column_name'
```

**⚠️ GASを更新しないと、スプシ→DBの定期同期でそのカラムが無視される。**

### 3. Supabaseマイグレーション

`backend/supabase/migrations/` に新しいSQLファイルを作成：

```sql
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS db_column_name TEXT;
```

Supabaseダッシュボードで実行する。

---

## 🚨 過去の失敗事例（2026年3月）

**問題**: `vendor_survey`（業者向けアンケート）カラムを追加した際、GASの `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` を追加し忘れた。

**結果**: スプシのFZ列に「確認済み」が入っていても、GASの定期同期でDBに反映されなかった。

**教訓**: `buyer-column-mapping.json` だけ更新しても不十分。GASも必ず更新する。

---

## ✅ GASの同期方式（2026年3月以降）

GASの `buyerMapRowToRecord` 関数は**ヘッダー名ベースの動的マッピング**に変更済み。

`BUYER_COLUMN_MAPPING` に定義されていないカラムは自動的にスキップされるため、**新しいカラムを追加したら必ずGASの `BUYER_COLUMN_MAPPING` にも追加すること**。

---

## 📝 チェックリスト

買主カラムを追加する前に確認：

- [ ] `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` に追加したか？
- [ ] GASの `BUYER_COLUMN_MAPPING` に追加したか？
- [ ] Supabaseマイグレーションを実行したか？
- [ ] `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に追加したか？（表示が必要な場合）
- [ ] `NewBuyerPage.tsx` にも追加したか？（新規登録時に入力が必要な場合）

---

**最終更新日**: 2026年3月25日
**作成理由**: `vendor_survey` カラム追加時にGASの更新を忘れ、スプシ→DB同期が機能しなかった問題の再発防止
