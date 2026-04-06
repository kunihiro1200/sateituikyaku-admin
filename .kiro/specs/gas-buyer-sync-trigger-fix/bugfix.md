# バグ修正仕様書：買主リストGAS同期トリガーエラー修正

## バグの概要

**症状**: 買主7300の「3回架電確認済み」「【問合メール】電話対応」がスプレッドシートからDBに同期されない

**根本原因**: GASトリガーが存在しない関数`syncBuyerDeletions`を呼び出そうとしてエラーになっている

**エラーメッセージ**: `Script function not found: syncBuyerDeletions`

---

## バグ条件 C(X)

### 入力 X
- GASトリガーが10分ごとに実行される
- トリガーが呼び出す関数名: `syncBuyerDeletions`
- 実際のGASコードに存在する関数名: `syncBuyerList`

### バグ条件 C(X) = true の場合
以下の条件を**すべて満たす**場合、バグが発生する：

1. **トリガー設定が古い関数名を参照している**
   - トリガーのハンドラー関数が`syncBuyerDeletions`になっている
   - 実際のコードには`syncBuyerDeletions`関数が存在しない

2. **トリガーが実行される**
   - 10分ごとにトリガーが起動する
   - `syncBuyerDeletions`関数を探すが見つからない
   - エラーが発生して同期処理が実行されない

3. **結果として同期が失敗する**
   - スプレッドシートの変更がDBに反映されない
   - 買主7300の「3回架電確認済み」「【問合メール】電話対応」が同期されない

### バグ条件 C(X) = false の場合（正常動作）
以下の条件を満たす場合、正常に動作する：

1. **トリガー設定が正しい関数名を参照している**
   - トリガーのハンドラー関数が`syncBuyerList`になっている
   - `syncBuyerList`関数が実際に存在する

2. **トリガーが正常に実行される**
   - 10分ごとにトリガーが起動する
   - `syncBuyerList`関数が正常に実行される
   - スプレッドシートの変更がDBに同期される

---

## 現在の状態

### GASコード（BuyerSync.gs）
```javascript
// ✅ この関数は存在する
function syncBuyerList() {
  var startTime = new Date();
  Logger.log('=== 買主リスト同期開始: ' + startTime.toISOString() + ' ===');
  
  // Phase 1: 追加同期
  // Phase 2: 更新同期（Supabase直接更新）
  syncUpdatesToSupabase_(sheetRows);
  // Phase 3: 削除同期
  
  Logger.log('=== 同期完了 ===');
}

// ✅ トリガー設定関数も存在する
function setupBuyerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBuyerList') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncBuyerList')
    .timeBased()
    .everyMinutes(10)
    .create();
}
```

### トリガー設定（推測）
```
❌ 関数名: syncBuyerDeletions ← 存在しない関数
   実行間隔: 10分ごと
   最終実行: 失敗（Script function not found）
```

---

## 影響範囲

### 影響を受けるデータ
- **買主7300**の以下のフィールドが同期されない：
  - `3回架電確認済み`（DBカラム: `three_calls_confirmed`）
  - `【問合メール】電話対応`（DBカラム: `inquiry_email_phone_response`）

### 影響を受ける可能性のある他のデータ
- **すべての買主データ**が同期されていない可能性がある
- トリガーがエラーで停止しているため、最後の成功した同期以降の変更がすべて反映されていない

---

## 修正方針

### 修正1: トリガー設定を修正する（推奨）

**方法**: 既存のトリガーを削除して、正しい関数名で再作成する

**手順**:
1. Google Apps Scriptエディタを開く
2. 左メニューの「トリガー」（時計アイコン）をクリック
3. 既存のトリガー（`syncBuyerDeletions`を呼び出しているもの）を削除
4. `setupBuyerSyncTrigger()`関数を手動実行して新しいトリガーを作成

**メリット**:
- コード変更不要
- 既存のロジックをそのまま使える
- 即座に修正できる

### 修正2: 互換性のために`syncBuyerDeletions`関数を追加する（非推奨）

**方法**: `syncBuyerDeletions`関数を作成して、内部で`syncBuyerList`を呼び出す

```javascript
// 後方互換性のための関数
function syncBuyerDeletions() {
  Logger.log('⚠️ syncBuyerDeletions is deprecated. Use syncBuyerList instead.');
  syncBuyerList();
}
```

**デメリット**:
- 不要なコードが残る
- 将来的に混乱を招く可能性がある

---

## 検証方法

### 修正前の検証（バグの再現）

1. **トリガー設定を確認**
   ```
   Google Apps Script > トリガー > 既存のトリガーを確認
   → 関数名が「syncBuyerDeletions」になっているか確認
   ```

2. **実行ログを確認**
   ```
   実行ログ > 最新のエラーを確認
   → "Script function not found: syncBuyerDeletions" が表示されるか確認
   ```

3. **買主7300のDBデータを確認**
   ```sql
   SELECT buyer_number, three_calls_confirmed, inquiry_email_phone_response
   FROM buyers
   WHERE buyer_number = '7300';
   ```
   → スプレッドシートの値と一致しないことを確認

### 修正後の検証（バグの修正確認）

1. **トリガー設定を確認**
   ```
   Google Apps Script > トリガー > 新しいトリガーを確認
   → 関数名が「syncBuyerList」になっているか確認
   ```

2. **手動実行してログを確認**
   ```
   BuyerSync.gs > syncBuyerList() を手動実行
   → エラーが発生しないことを確認
   → "=== 同期完了 ===" が表示されることを確認
   ```

3. **買主7300のDBデータを再確認**
   ```sql
   SELECT buyer_number, three_calls_confirmed, inquiry_email_phone_response
   FROM buyers
   WHERE buyer_number = '7300';
   ```
   → スプレッドシートの値と一致することを確認

4. **10分後に自動実行されることを確認**
   ```
   実行ログ > 10分後のログを確認
   → "=== 買主リスト同期開始 ===" が表示されることを確認
   → エラーが発生しないことを確認
   ```

---

## 正解性プロパティ（Property-Based Testing）

### プロパティ1: トリガーが正しい関数を呼び出す

**仕様**:
```
∀ trigger ∈ ProjectTriggers:
  trigger.handlerFunction = "syncBuyerList"
  ⇒ trigger.execute() は成功する
```

**テスト方法**:
```javascript
function testTriggerHandlerFunction() {
  var triggers = ScriptApp.getProjectTriggers();
  var buyerSyncTriggers = triggers.filter(function(t) {
    return t.getHandlerFunction() === 'syncBuyerList';
  });
  
  if (buyerSyncTriggers.length === 0) {
    throw new Error('❌ syncBuyerList トリガーが見つかりません');
  }
  
  if (buyerSyncTriggers.length > 1) {
    throw new Error('❌ syncBuyerList トリガーが複数存在します');
  }
  
  Logger.log('✅ トリガー設定が正しい');
}
```

### プロパティ2: スプレッドシートの変更がDBに反映される

**仕様**:
```
∀ buyer ∈ Spreadsheet:
  buyer.three_calls_confirmed = "確認済み"
  ⇒ (10分後) DB.buyers[buyer.buyer_number].three_calls_confirmed = "確認済み"
```

**テスト方法**:
```javascript
function testBuyerSyncReflectsChanges() {
  // 1. スプレッドシートで買主7300の「3回架電確認済み」を変更
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('買主リスト');
  var buyerRow = findBuyerRow(sheet, '7300');
  var threeCallsCol = findColumnIndex(sheet, '3回架電確認済み');
  var originalValue = sheet.getRange(buyerRow, threeCallsCol).getValue();
  var testValue = '確認済み_' + new Date().getTime();
  sheet.getRange(buyerRow, threeCallsCol).setValue(testValue);
  
  // 2. 同期を実行
  syncBuyerList();
  
  // 3. DBから取得して確認
  var dbBuyers = fetchAllBuyersFromSupabase_();
  var buyer7300 = dbBuyers.find(function(b) { return b.buyer_number === '7300'; });
  
  if (buyer7300.three_calls_confirmed !== testValue) {
    throw new Error('❌ 同期が失敗しました: ' + buyer7300.three_calls_confirmed + ' !== ' + testValue);
  }
  
  // 4. 元に戻す
  sheet.getRange(buyerRow, threeCallsCol).setValue(originalValue);
  syncBuyerList();
  
  Logger.log('✅ スプレッドシートの変更がDBに反映されました');
}
```

---

## 再発防止策

### 1. トリガー設定を自動化する

**問題**: 手動でトリガーを設定すると、関数名を間違える可能性がある

**解決策**: `setupBuyerSyncTrigger()`関数を使用してトリガーを自動設定する

```javascript
function setupBuyerSyncTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBuyerList') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // 新しいトリガーを作成
  ScriptApp.newTrigger('syncBuyerList')
    .timeBased()
    .everyMinutes(10)
    .create();
  
  Logger.log('✅ トリガーを設定しました: 10分ごと');
}
```

### 2. トリガー設定を検証する関数を追加する

**目的**: トリガーが正しく設定されているか定期的に確認する

```javascript
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
  
  Logger.log('✅ トリガー設定が正しい');
  return true;
}
```

### 3. エラー通知を追加する

**目的**: トリガーがエラーになった場合、即座に通知を受け取る

```javascript
function syncBuyerList() {
  try {
    var startTime = new Date();
    Logger.log('=== 買主リスト同期開始: ' + startTime.toISOString() + ' ===');
    
    // 同期処理...
    
    Logger.log('=== 同期完了 ===');
  } catch (e) {
    Logger.log('❌ 同期エラー: ' + e.toString());
    
    // エラー通知を送信（オプション）
    MailApp.sendEmail({
      to: 'admin@example.com',
      subject: '【エラー】買主リスト同期失敗',
      body: 'エラー内容: ' + e.toString() + '\n\nスタックトレース: ' + e.stack
    });
    
    throw e; // エラーを再スロー
  }
}
```

---

## まとめ

### バグの原因
- トリガーが存在しない関数`syncBuyerDeletions`を呼び出している
- 実際のコードには`syncBuyerList`関数しか存在しない

### 修正方法
1. 既存のトリガーを削除
2. `setupBuyerSyncTrigger()`を実行して新しいトリガーを作成

### 検証方法
1. トリガー設定を確認（関数名が`syncBuyerList`になっているか）
2. 手動実行してエラーが発生しないことを確認
3. 買主7300のDBデータがスプレッドシートと一致することを確認

### 再発防止
1. トリガー設定を自動化する
2. トリガー設定を検証する関数を追加する
3. エラー通知を追加する

---

**作成日**: 2026年4月6日  
**バグ発見日**: 2026年4月6日  
**影響範囲**: 買主7300（および他のすべての買主データ）  
**優先度**: 高（同期が完全に停止している）
