# 買主サイドバー「当日TEL」フィルタバグ 修正設計

## Overview

買主リストページ（`BuyersPage.tsx`）のサイドバーで「当日TEL」カテゴリをクリックした際、
`calculated_status === '当日TEL'`（担当なし）だけでなく `startsWith('当日TEL(')` に一致する
`当日TEL(Y)`, `当日TEL(I)` 等の担当あり当日TELも混入して表示されるバグを修正する。

修正方針は最小限：フィルタリング条件を完全一致（`===`）のみに統一する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `selectedCalculatedStatus` が `'当日TEL'` のとき、`startsWith('当日TEL(')` の買主も混入して表示される
- **Property (P)**: 期待される正しい動作 — `calculated_status === selectedCalculatedStatus` に完全一致する買主のみが表示される
- **Preservation**: 修正によって変えてはいけない既存の動作
- **calculated_status**: バックエンドで計算された買主のステータス文字列（例: `'当日TEL'`, `'当日TEL(Y)'`, `'担当(Y)'`）
- **selectedCalculatedStatus**: サイドバーでユーザーが選択したステータス文字列（`null` = 全件表示）
- **isBugCondition**: バグ条件を判定する関数（下記の形式仕様を参照）

## Bug Details

### Bug Condition

`selectedCalculatedStatus` に値が設定されているとき、フィルタリングロジックが完全一致だけでなく
`startsWith` による前方一致も含めているため、意図しないステータスの買主が混入する。

**Formal Specification:**
```
FUNCTION isBugCondition(selectedStatus, buyer)
  INPUT: selectedStatus: string | null, buyer: BuyerWithStatus
  OUTPUT: boolean

  IF selectedStatus IS NULL THEN
    RETURN false  // 全件表示モードはバグ条件に該当しない
  END IF

  RETURN buyer.calculated_status !== selectedStatus
         AND (buyer.calculated_status || '').startsWith(selectedStatus + '(')
         // ← この買主が「混入」している状態がバグ条件
END FUNCTION
```

### Examples

- `selectedCalculatedStatus = '当日TEL'` のとき:
  - `calculated_status = '当日TEL'` → ✅ 正しく表示される（完全一致）
  - `calculated_status = '当日TEL(Y)'` → ❌ 混入して表示される（バグ）
  - `calculated_status = '当日TEL(I)'` → ❌ 混入して表示される（バグ）
- サイドバーカウント: 1件（`=== '当日TEL'` のみ集計）
- 実際の表示件数: 8件（`=== '当日TEL'` 1件 + `startsWith('当日TEL(')` 7件）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `selectedCalculatedStatus = null`（全件表示）は変更なく動作する
- `selectedCalculatedStatus = '当日TEL(Y)'` 等の担当あり当日TELカテゴリをクリックした場合、完全一致のみ表示される（現状も完全一致だが、修正後も同様）
- `selectedCalculatedStatus = '担当(Y)'` 等の他カテゴリも完全一致のみ表示される
- 検索フィルタ（`debouncedSearch`）は変更なく動作する
- サイドバーのカウント集計ロジック（`buildCategoriesFromBuyers`）は変更しない
- `BuyerStatusCalculator` の `calculateBuyerStatus` ロジックは変更しない

**Scope:**
`selectedCalculatedStatus` が `null` の場合、または `startsWith` 条件に一致する買主が存在しない
ステータスを選択した場合は、修正の影響を受けない。

## Hypothesized Root Cause

`BuyersPage.tsx` の以下のフィルタリングコード（約100行目付近）に問題がある：

```typescript
// 現在の（バグあり）コード
let filtered = selectedCalculatedStatus !== null
  ? allBuyersWithStatusRef.current.filter(b =>
      b.calculated_status === selectedCalculatedStatus ||
      (b.calculated_status || '').startsWith(selectedCalculatedStatus + '(')
    )
  : [...allBuyersWithStatusRef.current];
```

`startsWith(selectedCalculatedStatus + '(')` の条件が意図せず追加されており、
`'当日TEL'` を選択したときに `'当日TEL(Y)'` 等も一致してしまう。

この条件は不要であり、完全一致（`===`）のみで十分。

## Correctness Properties

Property 1: Bug Condition - 完全一致フィルタリング

_For any_ `selectedCalculatedStatus` が非 `null` の値であるとき、修正後のフィルタリングロジックは
`calculated_status === selectedCalculatedStatus` に完全一致する買主のみを返し、
`startsWith` による前方一致で混入する買主を含めてはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非バグ条件の動作保持

_For any_ `selectedCalculatedStatus` が `null`（全件表示）の場合、または選択されたステータスに
`startsWith` で一致する買主が存在しない場合、修正後のフィルタリングロジックは
修正前と同一の結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyersPage.tsx`

**Function**: `fetchBuyers`（`useEffect` 内のフロントフィルタリングロジック）

**Specific Changes**:

1. **`startsWith` 条件を削除**: `||` 以降の `startsWith` 条件を完全に除去する

```typescript
// 修正前（バグあり）
let filtered = selectedCalculatedStatus !== null
  ? allBuyersWithStatusRef.current.filter(b =>
      b.calculated_status === selectedCalculatedStatus ||
      (b.calculated_status || '').startsWith(selectedCalculatedStatus + '(')
    )
  : [...allBuyersWithStatusRef.current];

// 修正後（正しい）
let filtered = selectedCalculatedStatus !== null
  ? allBuyersWithStatusRef.current.filter(b =>
      b.calculated_status === selectedCalculatedStatus
    )
  : [...allBuyersWithStatusRef.current];
```

変更箇所は1行のみ。他のロジックは一切変更しない。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、
次に修正後のコードで正しい動作とPreservationを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: フィルタリングロジックを直接テストし、`'当日TEL'` 選択時に
`'当日TEL(Y)'` が混入することを確認する。

**Test Cases**:
1. **当日TEL完全一致テスト**: `selectedCalculatedStatus = '当日TEL'` のとき、`calculated_status = '当日TEL'` の買主のみが返ることを期待 → 未修正コードでは `'当日TEL(Y)'` も含まれるため失敗
2. **担当あり当日TEL混入テスト**: `selectedCalculatedStatus = '当日TEL'` のとき、`calculated_status = '当日TEL(Y)'` の買主が含まれないことを期待 → 未修正コードでは含まれるため失敗
3. **カウント一致テスト**: フィルタ結果の件数がサイドバーカウント（1件）と一致することを期待 → 未修正コードでは8件になるため失敗

**Expected Counterexamples**:
- `'当日TEL'` フィルタ適用時に `'当日TEL(Y)'`, `'当日TEL(I)'` 等が結果に含まれる
- 原因: `startsWith('当日TEL(')` 条件が意図せず追加されている

### Fix Checking

**Goal**: 修正後、バグ条件に該当する全入力で正しい動作を確認する。

**Pseudocode:**
```
FOR ALL selectedStatus IN ['当日TEL', '当日TEL(Y)', '担当(Y)', ...] DO
  filtered := applyFilter_fixed(allBuyers, selectedStatus)
  FOR ALL buyer IN filtered DO
    ASSERT buyer.calculated_status === selectedStatus
  END FOR
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない入力で、修正前後の動作が同一であることを確認する。

**Pseudocode:**
```
FOR ALL selectedStatus WHERE NOT isBugCondition(selectedStatus, anyBuyer) DO
  ASSERT applyFilter_original(allBuyers, selectedStatus)
       = applyFilter_fixed(allBuyers, selectedStatus)
END FOR
```

**Testing Approach**: プロパティベーステストが有効。様々なステータス値と買主データの組み合わせを
自動生成し、完全一致フィルタの正しさを検証できる。

**Test Cases**:
1. **全件表示Preservation**: `selectedCalculatedStatus = null` のとき、全買主が返ることを確認
2. **他カテゴリPreservation**: `'担当(Y)'` 等の他カテゴリ選択時、完全一致のみ返ることを確認
3. **担当あり当日TELPreservation**: `'当日TEL(Y)'` 選択時、`'当日TEL(Y)'` のみ返ることを確認（修正前後で同一）

### Unit Tests

- `selectedCalculatedStatus = '当日TEL'` のとき `'当日TEL(Y)'` が含まれないことを確認
- `selectedCalculatedStatus = '当日TEL'` のとき `'当日TEL'` のみが含まれることを確認
- `selectedCalculatedStatus = null` のとき全件が返ることを確認
- 空の買主リストに対してフィルタが正常動作することを確認

### Property-Based Tests

- ランダムな `selectedCalculatedStatus` 値に対して、フィルタ結果の全要素が完全一致することを検証
- ランダムな買主データセットに対して、`null` 選択時は全件返ることを検証
- `startsWith` 条件に一致するステータスを持つ買主が、完全一致フィルタで除外されることを検証

### Integration Tests

- サイドバーの「当日TEL」カテゴリをクリックしたとき、表示件数がサイドバーカウントと一致することを確認
- 「当日TEL(Y)」カテゴリをクリックしたとき、担当なし当日TELが混入しないことを確認
- 「All」クリック後に「当日TEL」をクリックしたとき、正しい件数が表示されることを確認
