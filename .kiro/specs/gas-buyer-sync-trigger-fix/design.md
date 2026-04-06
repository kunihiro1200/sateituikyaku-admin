# 設計書：買主リストGAS同期トリガーエラー修正

## 修正概要

**目的**: GASトリガーが存在しない関数`syncBuyerDeletions`を呼び出してエラーになっている問題を修正する

**修正方法**: 既存のトリガーを削除して、正しい関数名`syncBuyerList`で再作成する

---

## 修正手順

### ステップ1: 現在のトリガー設定を確認

**目的**: どのトリガーが問題を引き起こしているか特定する

**手順**:
1. Google Apps Scriptエディタを開く
2. 左メニューの「トリガー」（時計アイコン）をクリック
3. 既存のトリガー一覧を確認
4. `syncBuyerDeletions`を呼び出しているトリガーを特定

**期待される結果**:
```
関数名: syncBuyerDeletions ← これが問題
実行間隔: 10分ごと
最終実行: 失敗（Script function not found）
```

---

### ステップ2: 問題のあるトリガーを削除

**目的**: 古いトリガー設定を削除する

**手順**:
1. トリガー一覧で`syncBuyerDeletions`を呼び出しているトリガーを選択
2. 右側の「...」メニューをクリック
3. 「トリガーを削除」を選択
4. 確認ダイアログで「削除」をクリック

**期待される結果**:
- トリガー一覧から`syncBuyerDeletions`トリガーが消える
- エラーログに新しいエラーが追加されなくなる

---

### ステップ3: 正しいトリガーを作成

**目的**: `syncBuyerList`関数を呼び出す新しいトリガーを作成する

**方法1: `setupBuyerSyncTrigger()`関数を使用（推奨）**

**手順**:
1. Google Apps Scriptエディタで`BuyerSync.gs`を開く
2. `setupBuyerSyncTrigger()`関数を選択
3. 上部の「実行」ボタンをクリック
4. 実行ログを確認

**期待される結果**:
```
✅ トリガーを設定しました: 10分ごと
```

**方法2: 手動でトリガーを作成**

**手順**:
1. 左メニューの「トリガー」をクリック
2. 右下の「トリガーを追加」ボタンをクリック
3. 以下の設定を入力：
   - 実行する関数を選択: `syncBuyerList`
   - 実行するデプロイを選択: `Head`
   - イベントのソースを選択: `時間主導型`
   - 時間ベースのトリガーのタイプを選択: `分ベースのタイマー`
   - 時間の間隔を選択（分）: `10分ごと`
4. 「保存」をクリック

**期待される結果**:
- トリガー一覧に新しいトリガーが追加される
- 関数名が`syncBuyerList`になっている

---

### ステップ4: トリガーが正しく動作することを確認

**目的**: 新しいトリガーがエラーなく実行されることを確認する

**手順**:
1. `BuyerSync.gs`を開く
2. `syncBuyerList()`関数を選択
3. 上部の「実行」ボタンをクリック
4. 実行ログを確認

**期待される結果**:
```
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

**エラーが発生しないことを確認**:
- `Script function not found`エラーが表示されない
- `=== 同期完了 ===`が表示される

---

### ステップ5: 買主7300のデータが同期されることを確認

**目的**: 実際にスプレッドシートの変更がDBに反映されることを確認する

**手順**:
1. スプレッドシート「買主リスト」を開く
2. 買主7300の行を探す
3. 「3回架電確認済み」列の値を確認（例: "確認済み"）
4. 「【問合メール】電話対応」列の値を確認（例: "対応済み"）
5. `syncBuyerList()`を手動実行
6. Supabaseで買主7300のデータを確認

**Supabaseでの確認方法**:
```sql
SELECT 
  buyer_number,
  three_calls_confirmed,
  inquiry_email_phone_response,
  updated_at
FROM buyers
WHERE buyer_number = '7300';
```

**期待される結果**:
- `three_calls_confirmed`がスプレッドシートの値と一致する
- `inquiry_email_phone_response`がスプレッドシートの値と一致する
- `updated_at`が最新の日時になっている

---

### ステップ6: 10分後に自動実行されることを確認

**目的**: トリガーが自動的に実行されることを確認する

**手順**:
1. 10分待つ
2. Google Apps Scriptエディタの「実行ログ」を確認
3. 最新のログに`=== 買主リスト同期開始 ===`が表示されることを確認

**期待される結果**:
```
2026-04-06 XX:XX:XX  === 買主リスト同期開始: 2026-04-06T... ===
2026-04-06 XX:XX:XX  📊 スプレッドシート行数: XXX
...
2026-04-06 XX:XX:XX  === 同期完了 ===
```

---

## トラブルシューティング

### 問題1: `setupBuyerSyncTrigger()`実行時に権限エラーが発生する

**エラーメッセージ**:
```
Exception: このアプリケーションには、トリガーを作成する権限がありません
```

**原因**: スクリプトに必要な権限が付与されていない

**解決方法**:
1. `setupBuyerSyncTrigger()`を実行
2. 権限の承認ダイアログが表示される
3. 「権限を確認」をクリック
4. Googleアカウントを選択
5. 「詳細」→「（プロジェクト名）に移動」をクリック
6. 「許可」をクリック

---

### 問題2: トリガーが実行されるが、同期が失敗する

**症状**: 実行ログに`=== 買主リスト同期開始 ===`は表示されるが、エラーが発生する

**原因1**: `GAS_API_KEY`が設定されていない

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

**原因2**: バックエンドAPIがダウンしている

**エラーメッセージ**:
```
❌ 追加同期失敗: HTTP 500
```

**解決方法**:
1. Vercelダッシュボードで`baikyaku-property-site3`プロジェクトを確認
2. デプロイメントログを確認
3. エラーがある場合は修正してデプロイ

---

### 問題3: 買主7300のデータが同期されない

**症状**: `syncBuyerList()`は成功するが、買主7300のデータがDBに反映されない

**原因1**: スプレッドシートの列名が間違っている

**確認方法**:
1. スプレッドシート「買主リスト」の1行目（ヘッダー行）を確認
2. 以下の列名が正確に一致しているか確認：
   - `3回架電確認済み`（全角、スペースなし）
   - `【問合メール】電話対応`（全角、【】を含む）

**原因2**: 買主7300がDBに存在しない

**確認方法**:
```sql
SELECT buyer_number FROM buyers WHERE buyer_number = '7300';
```

**解決方法**:
- 買主7300がDBに存在しない場合、Phase 1（追加同期）で追加される
- `syncBuyerList()`を再実行して確認

**原因3**: スプレッドシートの値が空文字または空白

**確認方法**:
1. スプレッドシートで買主7300の「3回架電確認済み」セルを選択
2. 値が空文字または空白でないことを確認

**解決方法**:
- 空文字の場合、DBでは`null`として保存される
- 値を入力して再度同期を実行

---

## コード変更（オプション）

### 変更1: トリガー検証関数を追加

**目的**: トリガーが正しく設定されているか確認する関数を追加

**ファイル**: `BuyerSync.gs`

**追加するコード**:
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

**使用方法**:
```javascript
// トリガー設定を確認
validateBuyerSyncTrigger();
```

---

### 変更2: エラー通知を追加（オプション）

**目的**: トリガーがエラーになった場合、メールで通知を受け取る

**ファイル**: `BuyerSync.gs`

**変更するコード**:
```javascript
function syncBuyerList() {
  try {
    var startTime = new Date();
    Logger.log('=== 買主リスト同期開始: ' + startTime.toISOString() + ' ===');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('買主リスト');
    if (!sheet) { 
      throw new Error('シート「買主リスト」が見つかりません'); 
    }
    
    // ... 同期処理 ...
    
    Logger.log('=== 同期完了 ===');
  } catch (e) {
    Logger.log('❌ 同期エラー: ' + e.toString());
    Logger.log('スタックトレース: ' + e.stack);
    
    // エラー通知を送信（オプション）
    try {
      MailApp.sendEmail({
        to: Session.getActiveUser().getEmail(), // 実行ユーザーにメール送信
        subject: '【エラー】買主リスト同期失敗',
        body: 
          'エラー内容: ' + e.toString() + '\n\n' +
          'スタックトレース:\n' + e.stack + '\n\n' +
          '実行日時: ' + new Date().toISOString()
      });
    } catch (mailError) {
      Logger.log('⚠️ メール送信失敗: ' + mailError.toString());
    }
    
    throw e; // エラーを再スロー
  }
}
```

---

## まとめ

### 修正手順（簡易版）

1. **トリガーを削除**: Google Apps Script > トリガー > `syncBuyerDeletions`を削除
2. **新しいトリガーを作成**: `setupBuyerSyncTrigger()`を実行
3. **動作確認**: `syncBuyerList()`を手動実行してエラーがないことを確認
4. **データ確認**: 買主7300のデータがDBに同期されることを確認

### 所要時間

- トリガー削除: 1分
- 新しいトリガー作成: 1分
- 動作確認: 5分
- データ確認: 3分

**合計**: 約10分

### 注意事項

- トリガーを削除してから新しいトリガーを作成するまでの間、自動同期は停止します
- 作業は10分以内に完了させることを推奨します
- 作業中にスプレッドシートを編集した場合、手動で`syncBuyerList()`を実行してください

---

**作成日**: 2026年4月6日  
**最終更新日**: 2026年4月6日
