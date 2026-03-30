# 物件リストGAS同期スクリプト デプロイ手順

## 📋 概要

ローカルの`gas/property-listing-sync/PropertyListingSync.gs`の最新コードをGASプロジェクト（スプレッドシートに紐づいたGASエディタ）にデプロイします。

**重要**: 営業担当フィールド同期バグの修正が含まれています。

---

## 🐛 修正内容

### バグの概要

AA12497を含む約5-6件の物件で、スプレッドシートの「担当名（営業）」列に値が入力されているにもかかわらず、データベースの`property_listings.sales_assignee`が`null`のまま同期されていなかった。

### 根本原因

ヘッダー名の微妙な違い（全角括弧/半角括弧、前後のスペース）により、GASの`COLUMN_MAPPING`と正確にマッチしていなかった。

### 修正内容

1. **`normalizeHeader()`関数を追加**:
   - 前後のスペースを除去（`trim()`）
   - 全角括弧（）を半角括弧()に統一

2. **`mapRowToRecord()`関数を修正**:
   - ヘッダー名を正規化してからマッピング
   - 正規化されたヘッダーでマッチしない場合、元のヘッダーでも試行（後方互換性）
   - 未マッピングヘッダーをログ出力（デバッグ用）

3. **`COLUMN_MAPPING`に半角括弧版を追加**:
   - `'担当名(営業)': 'sales_assignee'`
   - その他の括弧付きフィールドも半角版を追加

---

## 🚀 デプロイ手順

### ステップ1: ローカルのGASコードを確認

1. `gas/property-listing-sync/PropertyListingSync.gs`を開く
2. 以下の修正が含まれていることを確認：
   - `normalizeHeader()`関数が存在する
   - `mapRowToRecord()`関数が`normalizeHeader()`を呼び出している
   - `COLUMN_MAPPING`に`'担当名(営業)': 'sales_assignee'`が存在する

### ステップ2: GASエディタを開く

1. 物件リストスプレッドシート（物件シート）を開く
   - スプレッドシートID: `1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY`
2. メニューから「拡張機能」→「Apps Script」を選択
3. GASエディタが開く

### ステップ3: 最新コードをコピー

1. ローカルの`gas/property-listing-sync/PropertyListingSync.gs`の内容を**全て**コピー
2. GASエディタの`PropertyListingSync.gs`（または`コード.gs`）に貼り付け
3. **保存**（Ctrl+S または ⌘+S）

### ステップ4: テスト実行

1. GASエディタで関数を選択：`testSync`
2. 「実行」ボタンをクリック
3. 初回実行時は権限の承認が必要
4. 実行ログを確認してエラーがないことを確認

### ステップ5: AA12497を手動同期

1. GASエディタで関数を選択：`syncSingleProperty`
2. 関数を編集して引数を追加：
   ```javascript
   function testSyncAA12497() {
     syncSingleProperty('AA12497');
   }
   ```
3. `testSyncAA12497`を実行
4. 実行ログを確認：
   ```
   レコード: {"property_number":"AA12497","sales_assignee":"裏",...}
   結果: {"success":true}
   ```

### ステップ6: データベースを確認

1. Supabaseダッシュボードを開く
2. `property_listings`テーブルを開く
3. AA12497の`sales_assignee`が`"裏"`になっていることを確認

---

## ✅ 確認事項

デプロイ後、以下を確認してください：

- [ ] GASエディタに`normalizeHeader()`関数が存在する
- [ ] GASエディタの`COLUMN_MAPPING`に`'担当名(営業)': 'sales_assignee'`が存在する
- [ ] `testSync()`が正常に実行される（エラーなし）
- [ ] `syncSingleProperty('AA12497')`が正常に実行される
- [ ] 実行ログに`{"success":true}`が表示される
- [ ] データベースのAA12497の`sales_assignee`が`"裏"`になっている

---

## 🔍 トラブルシューティング

### エラー: "ReferenceError: normalizeHeader is not defined"

**原因**: コードの一部のみがコピーされた

**解決策**: `gas/property-listing-sync/PropertyListingSync.gs`の内容を**全て**コピーして再度貼り付け

### エラー: "Exception: Request failed for https://krxhrbtlgfjzsseegaqq.supabase.co returned code 401"

**原因**: Supabaseの認証エラー

**解決策**: `CONFIG.SUPABASE_SERVICE_KEY`が正しいか確認

### AA12497の`sales_assignee`が依然として`null`

**原因**: スプレッドシートのヘッダー名が想定と異なる

**解決策**:
1. スプレッドシートの「担当名（営業）」列のヘッダー名を確認
2. GASエディタの実行ログで「未マッピングヘッダー」を確認
3. 必要に応じて`COLUMN_MAPPING`に追加

---

## 📊 次回の10分トリガー実行

デプロイ後、次回の10分トリガー実行時に最新コードが自動的に実行されます。

**確認方法**:
1. GASエディタの「実行数」タブを開く
2. 次回の`syncPropertyListings`実行ログを確認
3. エラーがないことを確認
4. AA12497を含む未同期物件が正しく同期されることを確認

---

## 📝 影響を受ける物件

以下の物件の営業担当が正しく同期されるようになります：

- AA12497（営業担当: 裏）
- その他約5件の未同期物件

---

**作成日**: 2026年3月31日
**目的**: 物件リストGAS同期スクリプトの営業担当フィールド同期バグ修正をGASプロジェクトにデプロイ
**関連Spec**: `.kiro/specs/property-listing-sales-assignee-sync-bug/`
