# Supabaseマイグレーション実行手順

## ⚠️ 重要：2つのエラーを修正

現在、以下の2つのエラーが発生しています：

1. **`visit_time`カラム不在**: `sellers`テーブルに`visit_time`カラムが存在しない
2. **AA13846のVARCHAR(100)制限エラー**: 以下の3つのカラムが100文字制限を超えている
   - `floor_plan`（間取り）: 256文字
   - `comments`（コメント）: 273文字
   - `cancellation_notice`（キャンセル案内）: 293文字

---

## 📋 実行手順

### ステップ1: Supabase SQL Editorを開く

1. Supabaseダッシュボードにログイン
2. 左サイドバーから「SQL Editor」を選択
3. 「New query」をクリック

---

### ステップ2: 以下のSQLをコピー＆ペースト

```sql
-- Fix VARCHAR(100) limits for long text fields and add visit_time column
-- AA13846のデータ長エラーを修正し、訪問時間カラムを追加

-- 1. 間取り（floor_plan）をTEXT型に変更（256文字のデータあり）
ALTER TABLE sellers ALTER COLUMN floor_plan TYPE TEXT;
COMMENT ON COLUMN sellers.floor_plan IS '間取り（TEXT型、長文対応）';

-- 2. コメント（comments）をTEXT型に変更（273文字のデータあり）
ALTER TABLE sellers ALTER COLUMN comments TYPE TEXT;
COMMENT ON COLUMN sellers.comments IS 'コメント（TEXT型、長文対応）';

-- 3. キャンセル案内（cancellation_notice）をTEXT型に変更（293文字のデータあり）
ALTER TABLE sellers ALTER COLUMN cancellation_notice TYPE TEXT;
COMMENT ON COLUMN sellers.cancellation_notice IS 'キャンセル案内（TEXT型、長文対応）';

-- 4. 訪問時間（visit_time）カラムを追加
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS visit_time VARCHAR(20);
COMMENT ON COLUMN sellers.visit_time IS '訪問時間（例: 10:00、14:30）';

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ マイグレーション完了:';
  RAISE NOTICE '   - floor_plan: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - comments: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - cancellation_notice: VARCHAR(100) → TEXT';
  RAISE NOTICE '   - visit_time: 追加（VARCHAR(20)）';
END $$;
```

---

### ステップ3: SQLを実行

1. 「Run」ボタンをクリック
2. 実行結果を確認
3. エラーがないことを確認

**期待される出力**:
```
✅ マイグレーション完了:
   - floor_plan: VARCHAR(100) → TEXT
   - comments: VARCHAR(100) → TEXT
   - cancellation_notice: VARCHAR(100) → TEXT
   - visit_time: 追加（VARCHAR(20)）
```

---

### ステップ4: GASコードをGoogle Apps Scriptエディタにコピー

1. Google スプレッドシート（売主リスト）を開く
2. 「拡張機能」→「Apps Script」を選択
3. `gas_complete_code.js`の内容を**全て**コピー
4. GASエディタに**全て**ペースト（既存コードを上書き）
5. 保存（Ctrl+S）
6. `syncSellerList`関数を選択
7. 「実行」ボタンをクリック
8. 実行ログを確認

**期待されるログ**:
```
✅ AA13846: 更新
✅ FI00006: 更新
```

---

### ステップ5: 本番環境で動作確認

1. ブラウザで売主リストページを開く
2. 「FI6」で検索してFI00006が表示されることを確認
3. 「AA13501」で検索して正常に動作することを確認（回帰テスト）

---

## 🎯 完了条件

- [ ] Supabase SQL Editorでマイグレーションを実行
- [ ] エラーなく完了
- [ ] GASコードをGoogle Apps Scriptエディタにコピー
- [ ] `syncSellerList`を手動実行
- [ ] AA13846とFI00006が正常に同期される
- [ ] 本番環境で「FI6」検索が正常に動作

---

## 📝 トラブルシューティング

### 問題1: マイグレーション実行時にエラー

**エラー例**:
```
column "visit_time" of relation "sellers" already exists
```

**原因**: `visit_time`カラムが既に存在する

**解決策**: 問題なし（`IF NOT EXISTS`で重複を防いでいる）

---

### 問題2: GAS実行時にエラー

**エラー例**:
```
❌ AA13846: 更新失敗 - value too long for type character varying(100)
```

**原因**: マイグレーションが未実行

**解決策**: ステップ2のSQLを再度実行

---

## 📚 関連ファイル

- `backend/supabase/migrations/20260405000002_fix_varchar_limits_and_add_visit_time.sql` - マイグレーションSQL
- `gas_complete_code.js` - GASコード（1027行目にvisit_time同期処理あり）
- `backend/check-aa13846-in-spreadsheet.ts` - AA13846のデータ長確認スクリプト

---

**最終更新日**: 2026年4月5日  
**作成理由**: `visit_time`カラム追加とVARCHAR(100)制限エラー修正のため
