# buyer-latest-status-sync-fix Bugfix Design

## Overview

`BuyerViewingResultPage`の★最新状況フィールドで値を変更してもDBに保存されないバグを修正する。根本原因は`handleInlineFieldSave`が`sync=true`でAPIを呼ぶ際に`force=true`を渡していないため、バックエンドの`updateWithSync`が競合チェックを実行してDBへの保存をスキップすることにある。

## Glossary

- **Bug_Condition (C)**: `BuyerViewingResultPage`で`latest_status`フィールドを変更する操作
- **Property (P)**: 変更後の値がDBに保存され、ページ再訪時も反映されること
- **Preservation**: 他フィールドの保存動作、`BuyerDetailPage`の動作が変わらないこと
- **handleInlineFieldSave**: `BuyerViewingResultPage`内の関数。フィールド名と新しい値を受け取りAPIを呼ぶ
- **updateWithSync**: `BuyerService`のメソッド。`force=false`の場合、競合チェックを実行してDBへの保存をスキップする可能性がある
- **競合チェック**: `last_synced_at`が存在する場合にスプレッドシートの値とDBの値を比較する処理

## Bug Details

### Bug Condition

`BuyerViewingResultPage`の`handleInlineFieldSave`が`latest_status`フィールドを保存する際、`sync=true`のみを渡し`force=true`を渡していない。バックエンドの`updateWithSync`は`force=false`かつ`last_synced_at`が存在する場合に競合チェックを実行し、競合が検出されるとDBを更新せずに409を返す。フロントエンドの`buyerApi.update`は409を例外としてthrowせず古い`buyer`データを返すため、stateが古い値に上書きされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, page: string }
  OUTPUT: boolean
  
  RETURN input.page = 'BuyerViewingResultPage'
         AND input.fieldName = 'latest_status'
         AND force NOT IN apiCallOptions
END FUNCTION
```

### Examples

- 買主2564の内覧ページで★最新状況をCからBに変更 → 409競合エラー → stateがCに戻る（バグ）
- 買主詳細ページで★最新状況をCからBに変更 → 正常保存（正常）
- 内覧ページで内覧日を変更 → `sync=false`で呼ばれるため競合チェックなし → 正常保存（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `BuyerDetailPage`の★最新状況保存動作は変更しない
- `BuyerViewingResultPage`の他フィールド（内覧日、時間、後続担当等）の保存動作は変更しない
- `handleSaveViewingResult`（内覧結果・後続対応）の`force=true`設定は変更しない

**Scope:**
`BuyerViewingResultPage`の`handleInlineFieldSave`内で`latest_status`フィールドを保存する際のAPIオプションのみを変更する。

## Hypothesized Root Cause

1. **`force=true`の欠如**: `handleInlineFieldSave`が`{ sync: isLatestStatus }`のみを渡し、`force: true`を渡していない。`BuyerDetailPage`の`handleInlineFieldSave`も同様だが、`BuyerDetailPage`では`handleFieldSave`内で楽観的更新を先に行い、バックグラウンドで保存するため競合エラーが表面化しにくい

2. **競合チェックの誤発動**: `updateWithSync`は`last_synced_at`が存在する場合に競合チェックを実行する。内覧ページからの更新でも同じ競合チェックが走る

3. **409エラーの無音処理**: `buyerApi.update`は409を例外としてthrowせず古い`buyer`データを返す。`handleInlineFieldSave`は`result.buyer`でstateを更新するため、古い値に上書きされる

## Correctness Properties

Property 1: Bug Condition - latest_status保存の確実性

_For any_ `BuyerViewingResultPage`での`latest_status`変更操作において、固定関数は`force=true`を含むAPIオプションでバックエンドを呼び出し、DBへの保存を確実に実行する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他フィールド・他ページの保存動作

_For any_ `BuyerViewingResultPage`での`latest_status`以外のフィールド変更、または`BuyerDetailPage`での操作において、固定後のコードは元のコードと同じ動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

**Function**: `handleInlineFieldSave`

**Specific Changes**:
1. **`force: true`の追加**: `latest_status`フィールドの場合、`sync: true`に加えて`force: true`を渡す

```typescript
// 修正前
const result = await buyerApi.update(
  buyer_number!,
  { [fieldName]: newValue },
  { sync: isLatestStatus }
);

// 修正後
const result = await buyerApi.update(
  buyer_number!,
  { [fieldName]: newValue },
  { sync: isLatestStatus, force: isLatestStatus }
);
```

## Testing Strategy

### Validation Approach

まず未修正コードでバグを確認するテストを書き、次に修正後に同じテストがパスすることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで`latest_status`の保存が失敗することを確認する。

**Test Plan**: `handleInlineFieldSave('latest_status', 'B')`を呼んだ後、`buyerRef.current.latest_status`が`'B'`になっているかを確認する。`buyerApi.update`をモックして409を返すようにし、stateが古い値に戻ることを確認する。

**Test Cases**:
1. **409競合エラー時のstate確認**: `buyerApi.update`が409を返す場合、stateが古い値に戻ることを確認（未修正コードで失敗）
2. **force=falseでの保存試行**: `force=false`でAPIが呼ばれることを確認（未修正コードで確認）

**Expected Counterexamples**:
- `buyerApi.update`が`{ sync: true }`のみで呼ばれ、`force`が含まれていない
- 409レスポンス時にstateが古い値に上書きされる

### Fix Checking

**Goal**: 修正後、`latest_status`の変更がDBに保存されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleInlineFieldSave_fixed('latest_status', 'B')
  ASSERT buyerApi.update called with { sync: true, force: true }
  ASSERT buyer.latest_status = 'B'
END FOR
```

### Preservation Checking

**Goal**: 他フィールドの保存動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleInlineFieldSave_original(input) = handleInlineFieldSave_fixed(input)
END FOR
```

**Test Cases**:
1. **latest_viewing_dateの保存**: `force`なしで呼ばれることを確認
2. **viewing_timeの保存**: `force`なしで呼ばれることを確認

### Unit Tests

- `handleInlineFieldSave('latest_status', 'B')`が`{ sync: true, force: true }`でAPIを呼ぶことを確認
- `handleInlineFieldSave('latest_viewing_date', '2026-04-01')`が`{ sync: false }`でAPIを呼ぶことを確認

### Property-Based Tests

- `latest_status`の任意の有効な値に対して、`force=true`でAPIが呼ばれることを確認

### Integration Tests

- 内覧ページで★最新状況を変更後、ページを離れて戻ると変更が保持されることを確認
