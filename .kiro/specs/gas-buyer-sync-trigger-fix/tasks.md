# タスクリスト：買主リストGAS同期トリガーエラー修正

## タスク概要

GASトリガーが存在しない関数`syncBuyerDeletions`を呼び出してエラーになっている問題を修正する。

---

## タスク1: 現在のトリガー設定を確認・削除

### 目的
問題のあるトリガー（`syncBuyerDeletions`を呼び出しているもの）を特定して削除する

### 手順

1. **Google Apps Scriptエディタを開く**
   - スプレッドシート「買主リスト」を開く
   - メニュー: 拡張機能 > Apps Script

2. **トリガー一覧を確認**
   - 左メニューの「トリガー」（時計アイコン）をクリック
   - 既存のトリガー一覧を確認
   - `syncBuyerDeletions`を呼び出しているトリガーを特定

3. **問題のあるトリガーを削除**
   - トリガー一覧で`syncBuyerDeletions`トリガーを選択
   - 右側の「...」メニューをクリック
   - 「トリガーを削除」を選択
   - 確認ダイアログで「削除」をクリック

4. **他の古いトリガーも削除（もしあれば）**
   - `syncBuyerList`を呼び出している古いトリガーがあれば削除
   - トリガーは1つだけ残すようにする

### 期待される結果
- トリガー一覧から`syncBuyerDeletions`トリガーが消える
- トリガー一覧が空になる（または古い`syncBuyerList`トリガーのみ残る）

### 検証方法
```
Google Apps Script > トリガー > トリガー一覧を確認
→ syncBuyerDeletions トリガーが存在しないことを確認
```

---

## タスク2: 新しいトリガーを作成

### 目的
`syncBuyerList`関数を呼び出す新しいトリガーを作成する

### 手順

1. **`setupBuyerSyncTrigger()`関数を実行**
   - Google Apps Scriptエディタで`BuyerSync.gs`を開く
   - 関数選択ドロップダウンから`setupBuyerSyncTrigger`を選択
   - 上部の「実行」ボタン（▶）をクリック

2. **権限の承認（初回のみ）**
   - 権限の承認ダイアログが表示される場合：
     - 「権限を確認」をクリック
     - Googleアカウントを選択
     - 「詳細」→「（プロジェクト名）に移動」をクリック
     - 「許可」をクリック

3. **実行ログを確認**
   - 下部の「実行ログ」タブを確認
   - `✅ トリガーを設定しました: 10分ごと`が表示されることを確認

4. **トリガー一覧で確認**
   - 左メニューの「トリガー」をクリック
   - 新しいトリガーが追加されていることを確認
   - 関数名が`syncBuyerList`になっていることを確認
   - 実行間隔が「10分ごと」になっていることを確認

### 期待される結果
```
実行ログ:
✅ トリガーを設定しました: 10分ごと

トリガー一覧:
関数名: syncBuyerList
実行間隔: 10分ごと
最終実行: （まだ実行されていない）
```

### 検証方法
```javascript
// トリガー設定を検証
function validateBuyerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var buyerSyncTriggers = triggers.filter(function(t) {
    return t.getHandlerFunction() === 'syncBuyerList';
  });
  
  if (buyerSyncTriggers.length === 1) {
    Logger.log('✅ トリガー設定が正しい');
    return true;
  } else {
    Logger.log('❌ トリガー設定が正しくない');
    return false;
  }
}
```

---

## タスク3: 手動実行して動作確認

### 目的
新しいトリガーが正しく動作することを確認する

### 手順

1. **`syncBuyerList()`関数を手動実行**
   - Google Apps Scriptエディタで`BuyerSync.gs`を開く
   - 関数選択ドロップダウンから`syncBuyerList`を選択
   - 上部の「実行」ボタン（▶）をクリック

2. **実行ログを確認**
   - 下部の「実行ログ」タブを確認
   - エラーが発生していないことを確認
   - `=== 同期完了 ===`が表示されることを確認

3. **実行時間を確認**
   - 実行ログの最後に`所要時間: XX秒`が表示される
   - 実行時間が300秒（5分）以内であることを確認

### 期待される結果
```
実行ログ:
=== 買主リスト同期開始: 2026-04-06T... ===
📊 スプレッドシート行数: XXX
✅ 追加同期成功: X件追加
📥 Phase 2: Supabase直接更新同期開始...
📊 DB買主数: XXX
📅 受付日の降順にソート完了
📊 Phase 2完了: 更新 X件 / エラー 0件
✅ 削除同期成功: X件削除
  所要時間: XX秒
=== 同期完了 ===
```

### 検証方法
- エラーメッセージが表示されないことを確認
- `Script function not found`エラーが表示されないことを確認
- `=== 同期完了 ===`が表示されることを確認

---

## タスク4: 買主7300のデータが同期されることを確認

### 目的
実際にスプレッドシートの変更がDBに反映されることを確認する

### 手順

1. **スプレッドシートで買主7300のデータを確認**
   - スプレッドシート「買主リスト」を開く
   - 買主番号「7300」の行を探す
   - 「3回架電確認済み」列の値を確認（例: "確認済み"）
   - 「【問合メール】電話対応」列の値を確認（例: "対応済み"）

2. **Supabaseで買主7300のデータを確認（同期前）**
   - Supabaseダッシュボードを開く
   - Table Editor > buyers テーブルを開く
   - `buyer_number = '7300'`で検索
   - `three_calls_confirmed`と`inquiry_email_phone_response`の値を確認

3. **同期を実行**
   - Google Apps Scriptエディタで`syncBuyerList()`を実行

4. **Supabaseで買主7300のデータを確認（同期後）**
   - Supabaseダッシュボードでbuyersテーブルを再読み込み
   - `buyer_number = '7300'`で検索
   - `three_calls_confirmed`と`inquiry_email_phone_response`の値を確認
   - スプレッドシートの値と一致することを確認

### 期待される結果

**スプレッドシート**:
```
買主番号: 7300
3回架電確認済み: 確認済み
【問合メール】電話対応: 対応済み
```

**Supabase（同期後）**:
```sql
SELECT 
  buyer_number,
  three_calls_confirmed,
  inquiry_email_phone_response,
  updated_at
FROM buyers
WHERE buyer_number = '7300';

結果:
buyer_number: 7300
three_calls_confirmed: 確認済み
inquiry_email_phone_response: 対応済み
updated_at: 2026-04-06 XX:XX:XX (最新の日時)
```

### 検証方法
- スプレッドシートの値とSupabaseの値が一致することを確認
- `updated_at`が最新の日時になっていることを確認

---

## タスク5: 10分後に自動実行されることを確認

### 目的
トリガーが自動的に実行されることを確認する

### 手順

1. **10分待つ**
   - タスク2でトリガーを作成してから10分待つ
   - または、次のトリガー実行時刻を確認して待つ

2. **実行ログを確認**
   - Google Apps Scriptエディタの「実行ログ」を確認
   - 最新のログに`=== 買主リスト同期開始 ===`が表示されることを確認
   - エラーが発生していないことを確認

3. **トリガー一覧で最終実行時刻を確認**
   - 左メニューの「トリガー」をクリック
   - `syncBuyerList`トリガーの「最終実行」列を確認
   - 最新の日時が表示されていることを確認
   - ステータスが「成功」になっていることを確認

### 期待される結果

**実行ログ**:
```
2026-04-06 XX:XX:XX  === 買主リスト同期開始: 2026-04-06T... ===
2026-04-06 XX:XX:XX  📊 スプレッドシート行数: XXX
...
2026-04-06 XX:XX:XX  === 同期完了 ===
```

**トリガー一覧**:
```
関数名: syncBuyerList
実行間隔: 10分ごと
最終実行: 2026-04-06 XX:XX:XX
ステータス: 成功
```

### 検証方法
- 実行ログに新しいログが追加されていることを確認
- トリガーの「最終実行」が更新されていることを確認
- ステータスが「失敗」ではなく「成功」になっていることを確認

---

## タスク6: トリガー検証関数を追加（オプション）

### 目的
トリガーが正しく設定されているか確認する関数を追加する

### 手順

1. **`BuyerSync.gs`に検証関数を追加**
   - Google Apps Scriptエディタで`BuyerSync.gs`を開く
   - ファイルの最後に以下のコードを追加：

```javascript
// ============================================================
// トリガー検証
// ============================================================
function validateBuyerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var buyerSyncTriggers = triggers.filter(function(t) {
    return t.getHandlerFunction() === 'syncBuyerList';
  });
  
  if (buyerSyncTriggers.length === 0) {
    Logger.log('❌ syncBuyerList トリガーが見つかりません');
    Logger.log('→ setupBuyerSyncTrigger() を実行してトリガーを作成してください');
    return false;
  }
  
  if (buyerSyncTriggers.length > 1) {
    Logger.log('⚠️ syncBuyerList トリガーが複数存在します');
    Logger.log('→ 重複したトリガーを削除してください');
    return false;
  }
  
  var trigger = buyerSyncTriggers[0];
  Logger.log('✅ トリガー設定が正しい');
  Logger.log('  関数名: ' + trigger.getHandlerFunction());
  Logger.log('  トリガーID: ' + trigger.getUniqueId());
  return true;
}
```

2. **検証関数を実行**
   - 関数選択ドロップダウンから`validateBuyerSyncTrigger`を選択
   - 上部の「実行」ボタン（▶）をクリック

3. **実行ログを確認**
   - `✅ トリガー設定が正しい`が表示されることを確認

### 期待される結果
```
実行ログ:
✅ トリガー設定が正しい
  関数名: syncBuyerList
  トリガーID: XXXXXXXXXX
```

### 検証方法
- エラーメッセージが表示されないことを確認
- `✅ トリガー設定が正しい`が表示されることを確認

---

## 完了条件

以下のすべての条件を満たした場合、このバグ修正は完了とする：

- [ ] タスク1: 古いトリガー（`syncBuyerDeletions`）が削除されている
- [ ] タスク2: 新しいトリガー（`syncBuyerList`）が作成されている
- [ ] タスク3: `syncBuyerList()`が手動実行でエラーなく完了する
- [ ] タスク4: 買主7300のデータがスプレッドシートからDBに同期される
- [ ] タスク5: トリガーが10分ごとに自動実行される
- [ ] タスク6（オプション）: トリガー検証関数が追加されている

---

## トラブルシューティング

### 問題: `setupBuyerSyncTrigger()`実行時に権限エラー

**エラーメッセージ**:
```
Exception: このアプリケーションには、トリガーを作成する権限がありません
```

**解決方法**:
1. 権限の承認ダイアログで「権限を確認」をクリック
2. Googleアカウントを選択
3. 「詳細」→「（プロジェクト名）に移動」をクリック
4. 「許可」をクリック

---

### 問題: `syncBuyerList()`実行時に`GAS_API_KEY`エラー

**エラーメッセージ**:
```
❌ GAS_API_KEY is not set in Script Properties
```

**解決方法**:
1. Google Apps Scriptエディタで「プロジェクトの設定」（歯車アイコン）をクリック
2. 「スクリプト プロパティ」セクションで「スクリプト プロパティを追加」をクリック
3. プロパティ名: `GAS_API_KEY`
4. 値: （バックエンドAPIのAPIキー）
5. 「スクリプト プロパティを保存」をクリック

---

### 問題: 買主7300のデータが同期されない

**原因1**: スプレッドシートの列名が間違っている

**確認方法**:
- スプレッドシート「買主リスト」の1行目（ヘッダー行）を確認
- `3回架電確認済み`（全角、スペースなし）
- `【問合メール】電話対応`（全角、【】を含む）

**原因2**: 買主7300がDBに存在しない

**確認方法**:
```sql
SELECT buyer_number FROM buyers WHERE buyer_number = '7300';
```

**解決方法**:
- `syncBuyerList()`を実行してPhase 1（追加同期）で追加される

---

## 所要時間見積もり

- タスク1: 5分（トリガー削除）
- タスク2: 5分（新しいトリガー作成）
- タスク3: 5分（手動実行確認）
- タスク4: 10分（データ同期確認）
- タスク5: 10分（自動実行確認）
- タスク6: 5分（検証関数追加、オプション）

**合計**: 約40分（タスク6を含む）、約35分（タスク6を除く）

---

**作成日**: 2026年4月6日  
**最終更新日**: 2026年4月6日
