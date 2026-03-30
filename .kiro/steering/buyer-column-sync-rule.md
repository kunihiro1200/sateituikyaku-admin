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

## 🚨 過去の失敗事例

### 事例1: GASの `BUYER_COLUMN_MAPPING` 更新漏れ（2026年3月25日）

**問題**: `vendor_survey`（業者向けアンケート）カラムを追加した際、GASの `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` を追加し忘れた。

**結果**: スプシのFZ列に「確認済み」が入っていても、GASの定期同期でDBに反映されなかった。

**教訓**: `buyer-column-mapping.json` だけ更新しても不十分。GASも必ず更新する。

---

### 事例2: GASプロジェクトへのデプロイ漏れ（2026年3月31日）

**問題**: ローカルの`gas/buyer-sync/BuyerSync.gs`には`'業者向けアンケート': 'vendor_survey'`のマッピングが存在するが、GASプロジェクト（スプレッドシートに紐づいたGASエディタ）に最新コードがデプロイされていなかった。

**結果**: 10分トリガーが古いバージョンのコードを実行し、`vendor_survey`フィールドが同期されなかった。

**教訓**: 
- ローカルのGASコードを更新しただけでは不十分
- **GASプロジェクトに手動でコピーしてデプロイする必要がある**
- デプロイ後は`syncSingleBuyer()`で手動テストを実行して確認する

---

## ✅ GASの同期方式（2026年3月以降）

GASの `buyerMapRowToRecord` 関数は**ヘッダー名ベースの動的マッピング**に変更済み。

`BUYER_COLUMN_MAPPING` に定義されていないカラムは自動的にスキップされるため、**新しいカラムを追加したら必ずGASの `BUYER_COLUMN_MAPPING` にも追加すること**。

---

## 📝 チェックリスト

買主カラムを追加する前に確認：

- [ ] `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` に追加したか？
- [ ] **ローカルの** `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING` に追加したか？
- [ ] **GASプロジェクト（GASエディタ）に最新コードをデプロイしたか？** ← **最重要**
- [ ] GASエディタで`syncSingleBuyer()`を実行してテストしたか？
- [ ] Supabaseマイグレーションを実行したか？
- [ ] `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に追加したか？（表示が必要な場合）
- [ ] `NewBuyerPage.tsx` にも追加したか？（新規登録時に入力が必要な場合）

---

**最終更新日**: 2026年3月31日
**作成理由**: `vendor_survey` カラム追加時にGASの更新を忘れ、スプシ→DB同期が機能しなかった問題の再発防止
**更新履歴**:
- 2026年3月25日: 初版作成
- 2026年3月31日: GASプロジェクトへのデプロイ漏れ事例を追加、チェックリストに「GASプロジェクトにデプロイ」を追加
