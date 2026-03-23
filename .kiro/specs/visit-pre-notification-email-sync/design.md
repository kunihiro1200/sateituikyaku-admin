# 訪問事前通知メール担当 定期同期バグ修正 デザイン

## Overview

GASの定期同期（10分トリガー）において、スプレッドシートのCV列「訪問事前通知メール担当」がDBの`visit_reminder_assignee`カラムに同期されていないバグを修正する。

修正対象は`gas/seller-sync-clean.gs`の2箇所のみ：
1. `fetchAllSellersFromSupabase_`のフィールドリストに`visit_reminder_assignee`を追加
2. `syncUpdatesToSupabase_`の差分チェック・更新処理に`visit_reminder_assignee`を追加

バックエンドコード（`EnhancedAutoSyncService.ts`、`SellerService.supabase.ts`、`column-mapping.json`）は既に正しく実装済みのため、修正不要。

## Glossary

- **Bug_Condition (C)**: `syncUpdatesToSupabase_`が`visit_reminder_assignee`フィールドを処理しない条件 — 10分トリガーで`syncSellerList`が実行されるたびに発生
- **Property (P)**: 修正後の期待動作 — スプレッドシートのCV列の値がDBの`visit_reminder_assignee`に正しく反映される
- **Preservation**: 既存の11フィールド（`status`, `next_call_date`, `visit_assignee`, `unreachable_status`, `comments`, `phone_contact_person`, `preferred_contact_time`, `contact_method`, `contract_year_month`, `current_status`, `pinrich_status`）の同期動作が変わらないこと
- **`fetchAllSellersFromSupabase_`**: `gas/seller-sync-clean.gs`内の関数。SupabaseからDBの売主データを取得し、差分比較に使用する
- **`syncUpdatesToSupabase_`**: `gas/seller-sync-clean.gs`内のPhase 2更新同期関数。スプレッドシートとDBを比較し、差分があるフィールドをSupabaseに直接PATCHする
- **`visit_reminder_assignee`**: DBカラム名。スプレッドシートのCV列「訪問事前通知メール担当」に対応

## Bug Details

### Bug Condition

`syncSellerList`（10分トリガー）が実行されるたびに、`syncUpdatesToSupabase_`は`visit_reminder_assignee`フィールドを差分チェック対象に含めないため、CV列の値がDBに反映されない。また`fetchAllSellersFromSupabase_`がDBから`visit_reminder_assignee`を取得しないため、差分比較自体が行われない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SyncExecution
  OUTPUT: boolean

  RETURN input.trigger IN ['10min_scheduled', 'manual_syncSellerList']
         AND input.sheetColumn '訪問事前通知メール担当' HAS_VALUE
         AND NOT input.updateData CONTAINS 'visit_reminder_assignee'
END FUNCTION
```

### Examples

- AA13677: CV列に担当者名が入力済み → DBの`visit_reminder_assignee`が`null`のまま（バグあり）
- CV列が空欄の売主: DBの`visit_reminder_assignee`が`null`のまま → 差分なしで正常（バグなし）
- `syncVisitReminderAssignee()`を手動実行した場合: 正常に同期される（この関数は修正済み）

## Expected Behavior

### Preservation Requirements

**変わらない動作:**
- 既存の11フィールド（`status`, `next_call_date`, `visit_assignee`, `unreachable_status`, `comments`, `phone_contact_person`, `preferred_contact_time`, `contact_method`, `contract_year_month`, `current_status`, `pinrich_status`）の差分チェックと更新処理は変わらない
- CV列が空欄の場合、DBの`visit_reminder_assignee`を`null`に更新する（`syncVisitReminderAssignee`と同じ挙動）
- Phase 1（追加同期）・Phase 3（削除同期）の動作は変わらない
- `onEditTrigger`の動作は変わらない

**スコープ:**
`visit_reminder_assignee`以外の全フィールドの同期動作は、この修正によって一切影響を受けない。

## Hypothesized Root Cause

1. **フィールドリストの欠落**: `fetchAllSellersFromSupabase_`の`fields`変数に`visit_reminder_assignee`が含まれていないため、DBから取得したデータに`visit_reminder_assignee`が存在しない。差分比較の前提が成立しない。

2. **差分チェック処理の欠落**: `syncUpdatesToSupabase_`に`visit_reminder_assignee`の差分チェックブロックが存在しない。`pinrich_status`の処理で終わっており、その後に`visit_reminder_assignee`の処理が追加されていない。

3. **既存の一括同期関数との分離**: `syncVisitReminderAssignee()`という一括同期関数は存在するが、これは手動実行専用であり、10分トリガーの`syncSellerList`とは独立している。定期同期への組み込みが漏れていた。

## Correctness Properties

Property 1: Bug Condition - 訪問事前通知メール担当の定期同期

_For any_ 10分トリガーの実行において、スプレッドシートのCV列「訪問事前通知メール担当」の値とDBの`visit_reminder_assignee`に差分がある場合、修正後の`syncUpdatesToSupabase_`はその差分をSupabaseにPATCHし、DBの値をスプレッドシートの値と一致させる SHALL。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存フィールドの同期動作

_For any_ 10分トリガーの実行において、`visit_reminder_assignee`以外の既存11フィールドの差分チェックと更新処理は、修正前と修正後で同一の結果を生成する SHALL。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

**File**: `gas/seller-sync-clean.gs`

**修正1: `fetchAllSellersFromSupabase_`**

`fields`変数の末尾に`visit_reminder_assignee`を追加する。

```javascript
// 修正前
var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status';

// 修正後
var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status,visit_reminder_assignee';
```

**修正2: `syncUpdatesToSupabase_`**

`pinrich_status`の差分チェックブロックの直後に、`visit_reminder_assignee`の処理を追加する。

```javascript
// pinrich_status の処理の後に追加
// visit_reminder_assignee（訪問事前通知メール担当）
var sheetVisitReminder = row['訪問事前通知メール担当'] ? String(row['訪問事前通知メール担当']) : null;
var dbVisitReminder = dbSeller.visit_reminder_assignee || null;
if (sheetVisitReminder !== dbVisitReminder) {
  updateData.visit_reminder_assignee = sheetVisitReminder;
  needsUpdate = true;
}
```

**実装パターンの根拠**: 既存の`syncVisitReminderAssignee()`関数および他フィールド（`unreachable_status`、`pinrich_status`など）の実装パターンと完全に一致させる。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを確認し、次に修正後の動作と既存フィールドの保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで`visit_reminder_assignee`が同期されないことを確認し、根本原因を特定する。

**Test Plan**: CV列に値が入っている売主（例: AA13677）に対して`syncUpdatesToSupabase_`を実行し、DBの`visit_reminder_assignee`が更新されないことを確認する。

**Test Cases**:
1. **フィールドリスト確認**: `fetchAllSellersFromSupabase_`の戻り値に`visit_reminder_assignee`が含まれないことを確認（未修正コードで失敗）
2. **差分チェック確認**: `syncUpdatesToSupabase_`の`updateData`に`visit_reminder_assignee`が含まれないことを確認（未修正コードで失敗）
3. **DB値確認**: AA13677のDBの`visit_reminder_assignee`が`null`のままであることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `fetchAllSellersFromSupabase_`の戻り値に`visit_reminder_assignee`キーが存在しない
- `syncUpdatesToSupabase_`のログに`visit_reminder_assignee`が出力されない

### Fix Checking

**Goal**: 修正後、`visit_reminder_assignee`が正しく同期されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncUpdatesToSupabase_fixed(input)
  ASSERT result.updateData CONTAINS 'visit_reminder_assignee'
  ASSERT db.visit_reminder_assignee = sheet['訪問事前通知メール担当']
END FOR
```

### Preservation Checking

**Goal**: 修正後、既存11フィールドの同期動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncUpdatesToSupabase_original(input) = syncUpdatesToSupabase_fixed(input)
END FOR
```

**Testing Approach**: 既存フィールドの差分チェックロジックは変更しないため、修正前後で同一の動作が保証される。プロパティベーステストで多様な入力パターンを検証する。

**Test Cases**:
1. **既存フィールド保全**: `status`、`next_call_date`など既存11フィールドの差分チェックが修正前後で同一の結果を返すことを確認
2. **空欄処理**: CV列が空欄の場合、`visit_reminder_assignee`が`null`に更新されることを確認
3. **null処理**: DBの`visit_reminder_assignee`が`null`でCV列も空欄の場合、差分なしで更新されないことを確認

### Unit Tests

- `fetchAllSellersFromSupabase_`の戻り値に`visit_reminder_assignee`が含まれることを確認
- CV列に値がある場合、`updateData.visit_reminder_assignee`に値がセットされることを確認
- CV列が空欄の場合、`updateData.visit_reminder_assignee`が`null`になることを確認
- DB値とシート値が同じ場合、`needsUpdate`がtrueにならないことを確認

### Property-Based Tests

- ランダムな売主データで`visit_reminder_assignee`の差分チェックが正しく動作することを確認
- 既存11フィールドの差分チェックが`visit_reminder_assignee`追加後も変わらないことを確認
- 空文字列・null・undefined・通常文字列など多様な入力値で正しく処理されることを確認

### Integration Tests

- AA13677を含む複数の売主で`syncSellerList`を実行し、`visit_reminder_assignee`がDBに反映されることを確認
- 修正後の`syncSellerList`実行で既存フィールドの同期が正常に動作することを確認
- `syncVisitReminderAssignee()`（手動一括同期）と`syncUpdatesToSupabase_`（定期同期）の結果が一致することを確認
