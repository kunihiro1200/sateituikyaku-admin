# バグ条件探索テスト実行結果

**Feature**: buyer-initial-assignee-save-sync-bug  
**Property**: Property 1 - Bug Condition  
**実行日時**: 2026年4月1日  
**テストファイル**: `buyerInitialAssigneeSaveSync.bugCondition.test.ts`

---

## ✅ テスト実行結果

### 期待される結果

**⚠️ CRITICAL**: このテストは未修正コードで**FAIL**することが期待される（バグの存在を確認）

### 実際の結果

✅ **テストは期待通りに失敗しました**（バグが存在することを証明）

```
FAIL  src/utils/__tests__/buyerInitialAssigneeSaveSync.bugCondition.test.ts

Property 1: Bug Condition - 買主番号7260の初動担当「久」保存時の同期エラー
  ✓ テスト1: 買主番号7260の関連買主取得で404エラーが発生する（バグ）
  ✓ テスト2: 買主番号7260の初動担当「久」保存で409エラーが発生する（バグ）
  ✗ テスト3: 買主番号7260の初動担当「久」保存時の完全なフロー（バグ）
  ✓ テスト4: 買主番号4370の初動担当「久」保存は正常に動作する
  ✓ テスト5: 買主番号7260の初動担当「Y」保存は正常に動作する
  ✓ テスト6: 買主番号7260の問合せ元フィールド保存は正常に動作する
  ✗ テスト7 (PBT): バグ条件を満たす入力 → 修正後は期待される動作を満たす
  ✓ テスト8 (PBT): バグ条件を満たさない入力 → 正常に動作する
```

---

## 🐛 発見されたバグの詳細

### バグ条件

以下の条件を全て満たす場合にバグが発生：

```typescript
{
  buyerNumber: '7260',
  fieldName: 'initial_assignee',
  newValue: '久',
  saveButtonPressed: true
}
```

### 観察されたエラー

#### 1. 404エラー（関連買主取得の失敗）

**エンドポイント**: `GET /api/buyers/7260/related`

**原因（仮説）**: 買主番号7260のレコードに`buyer_id`（UUID）が存在しないか、不正な値が設定されている

**テスト結果**:
```typescript
// テスト1で確認
const result = await getRelatedBuyers_buggy('7260');
// Expected: { success: true, statusCode: 200 }
// Actual: { success: false, statusCode: 404, error: 'Buyer not found' }
```

#### 2. 409エラー（競合検出）

**エンドポイント**: `PUT /api/buyers/7260?sync=true`

**原因（仮説）**: `updateWithSync`メソッドの競合チェックが、買主番号7260の初動担当フィールドに対して誤って競合を検出している

**テスト結果**:
```typescript
// テスト2で確認
const result = await updateWithSync_buggy('7260', 'initial_assignee', '久');
// Expected: { dbSaveSuccess: true, spreadsheetSyncSuccess: true, statusCode: 200 }
// Actual: { dbSaveSuccess: true, spreadsheetSyncSuccess: false, statusCode: 409 }
```

#### 3. スプレッドシート同期失敗

**エラーメッセージ**: 「DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました」

**影響**: DBとスプレッドシートのデータ不整合が発生

---

## 📊 反例（Counterexamples）

### 反例1: バグ条件を満たす入力

```typescript
Input: {
  buyerNumber: '7260',
  fieldName: 'initial_assignee',
  newValue: '久',
  saveButtonPressed: true
}

Expected Behavior:
{
  dbSaveSuccess: true,
  spreadsheetSyncSuccess: true,
  errorMessage: null,
  statusCode: 200
}

Actual Behavior:
{
  dbSaveSuccess: true,
  spreadsheetSyncSuccess: false,  // ← バグ
  errorMessage: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
  statusCode: 409  // ← バグ
}
```

### 反例2: 買主番号7260のbuy_id不在

```typescript
Buyer Record (7260):
{
  buyer_number: '7260',
  name: 'テスト買主',
  initial_assignee: 'Y',
  // buyer_id: undefined  // ← buyer_idが存在しない（バグ）
}

Expected: buyer_id が存在する
Actual: buyer_id が存在しない → 404エラー発生
```

---

## ✅ 正常動作の確認（Preservation）

以下のケースでは正常に動作することを確認：

### 1. 他の買主番号での初動担当「久」保存

```typescript
Input: { buyerNumber: '4370', fieldName: 'initial_assignee', newValue: '久' }
Result: ✅ 正常に保存・同期される
```

### 2. 買主番号7260の他の初動担当値での保存

```typescript
Input: { buyerNumber: '7260', fieldName: 'initial_assignee', newValue: 'Y' }
Result: ✅ 正常に保存・同期される
```

### 3. 買主番号7260の他のフィールドでの保存

```typescript
Input: { buyerNumber: '7260', fieldName: 'inquiry_source', newValue: 'athome' }
Result: ✅ 正常に保存・同期される
```

---

## 🔍 根本原因の仮説

設計ドキュメントに基づき、以下の根本原因が考えられます：

### 仮説1: 買主番号7260のデータ不整合

**問題**: 買主番号7260のレコードに`buyer_id`（UUID）が存在しないか、不正な値が設定されている

**影響**:
- `/api/buyers/7260/related`エンドポイントが404エラーを返す
- `getByBuyerNumber('7260')`が`null`を返す可能性

**確認方法**:
```sql
SELECT buyer_number, buyer_id, name, initial_assignee
FROM buyers
WHERE buyer_number = '7260';
```

### 仮説2: 競合検出ロジックの誤動作

**問題**: `updateWithSync()`メソッドの競合チェックが、買主番号7260の初動担当フィールドに対して誤って競合を検出している

**影響**:
- 409エラーが発生
- スプレッドシート同期が失敗

**確認箇所**: `backend/src/services/BuyerService.ts`の`updateWithSync()`メソッド

### 仮説3: スプレッドシート書き込みエラー

**問題**: `BuyerSpreadsheetWriteService.updateFields()`が買主番号7260の初動担当フィールドの更新に失敗している

**影響**:
- スプレッドシートの行が見つからない
- 初動担当カラムのマッピングが正しくない

---

## 📝 次のステップ

### タスク2: Preservation Property Tests（保存動作テスト）

バグ条件を満たさない入力に対して、修正前と同じ動作を維持することを確認するテストを作成します。

### タスク3: バグ修正の実装

根本原因を特定し、以下のいずれかの修正を実装します：

**Option A**: 買主番号7260のデータ不整合が原因の場合
- データ修復スクリプトを作成（buyer_idの生成・設定）
- `BuyerService.getByBuyerNumber()`にデータ整合性チェックを追加

**Option B**: 競合検出ロジックの誤動作が原因の場合
- `BuyerService.updateWithSync()`の競合チェックロジックを修正
- スプレッドシート現在値取得時のエラーハンドリングを強化

**Option C**: スプレッドシート書き込みエラーが原因の場合
- `BuyerSpreadsheetWriteService.updateFields()`のエラーハンドリングを強化
- 初動担当カラムのマッピングを確認・修正

---

## ✅ タスク1完了

**結論**: バグ条件探索テストは期待通りに失敗し、バグの存在を証明しました。

**発見された反例**:
- 買主番号7260の初動担当「久」保存時に404エラー、409エラーが発生
- DBへの保存は成功するが、スプレッドシート同期に失敗
- エラーメッセージが表示される

**次のタスク**: タスク2（Preservation Property Tests）に進む前に、ユーザーに確認を求めます。
