# 買主リストGAS同期スクリプト デプロイ手順

## 📋 概要

ローカルの`gas/buyer-sync/BuyerSync.gs`の最新コードをGASプロジェクト（スプレッドシートに紐づいたGASエディタ）にデプロイします。

**重要**: `BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`のマッピングが含まれています。

---

## 🚀 デプロイ手順

### ステップ1: ローカルのGASコードを確認

1. `gas/buyer-sync/BuyerSync.gs`を開く
2. `BUYER_COLUMN_MAPPING`に以下のマッピングが存在することを確認：
   ```javascript
   '業者向けアンケート': 'vendor_survey'
   ```

### ステップ2: GASエディタを開く

1. 買主リストスプレッドシートを開く
2. メニューから「拡張機能」→「Apps Script」を選択
3. GASエディタが開く

### ステップ3: 最新コードをコピー

1. ローカルの`gas/buyer-sync/BuyerSync.gs`の内容を**全て**コピー
2. GASエディタの`BuyerSync.gs`（または`コード.gs`）に貼り付け
3. **保存**（Ctrl+S または ⌘+S）

### ステップ4: テスト実行

1. GASエディタで関数を選択：`buyerTestSync`
2. 「実行」ボタンをクリック
3. 初回実行時は権限の承認が必要
4. 実行ログを確認してエラーがないことを確認

### ステップ5: 買主番号7260を手動同期

1. GASエディタで関数を選択：`syncSingleBuyer`
2. 関数を編集して引数を追加：
   ```javascript
   function testSync7260() {
     syncSingleBuyer('7260');
   }
   ```
3. `testSync7260`を実行
4. 実行ログを確認：
   ```
   レコード: {"buyer_number":"7260","vendor_survey":"確認済み",...}
   結果: {"success":true}
   ```

---

## ✅ 確認事項

デプロイ後、以下を確認してください：

- [ ] GASエディタの`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在する
- [ ] `buyerTestSync()`が正常に実行される（エラーなし）
- [ ] `syncSingleBuyer('7260')`が正常に実行される
- [ ] 実行ログに`{"success":true}`が表示される

---

## 🔍 トラブルシューティング

### エラー: "ReferenceError: BUYER_COLUMN_MAPPING is not defined"

**原因**: コードの一部のみがコピーされた

**解決策**: `gas/buyer-sync/BuyerSync.gs`の内容を**全て**コピーして再度貼り付け

### エラー: "Exception: Request failed for https://krxhrbtlgfjzsseegaqq.supabase.co returned code 401"

**原因**: Supabaseの認証エラー

**解決策**: `BUYER_CONFIG.SUPABASE_SERVICE_KEY`が正しいか確認

---

## 📊 次回の10分トリガー実行

デプロイ後、次回の10分トリガー実行時に最新コードが自動的に実行されます。

**確認方法**:
1. GASエディタの「実行数」タブを開く
2. 次回の`syncBuyers`実行ログを確認
3. エラーがないことを確認

---

**作成日**: 2026年3月31日
**目的**: 買主リストGAS同期スクリプトの最新コードをGASプロジェクトにデプロイ
