# buyer-vendor-inquiry-sidebar-exclusion-bug Bugfix Design

## Overview

`BuyerStatusCalculator.ts` の Priority 2 条件に誤った除外条件 `!equals(buyer.broker_inquiry, '業者問合せ')` が含まれており、`vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` の買主がサイドバーの「業者問合せあり」カテゴリーに表示されないバグ。

正しい仕様は「`vendor_survey = '未'` であれば `broker_inquiry` の値に関係なく Priority 2（業者問合せあり）を返す」こと。修正は Priority 2 の条件から `!equals(buyer.broker_inquiry, '業者問合せ')` を削除するだけの最小限の変更で対応できる。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` の組み合わせ
- **Property (P)**: バグ条件が成立する入力に対して期待される動作 — `status: '業者問合せあり'`, `priority: 2` を返すこと
- **Preservation**: 修正によって変更してはならない既存の動作 — `broker_inquiry` が `'業者問合せ'` 以外の場合の Priority 2 判定、および Priority 1 の優先順位
- **calculateBuyerStatus**: `backend/src/services/BuyerStatusCalculator.ts` 内の関数。買主データを受け取り、優先順位付きのステータスを返す
- **vendor_survey**: 業者向けアンケートの回答状況を示すフィールド。`'未'` の場合は未回答
- **broker_inquiry**: 業者問合せの種別を示すフィールド。`'業者問合せ'` は業者からの問合せを意味する

## Bug Details

### Bug Condition

`vendor_survey = '未'` の買主のうち、`broker_inquiry = '業者問合せ'` の場合に限り Priority 2 の条件を満たさない。除外条件 `!equals(buyer.broker_inquiry, '業者問合せ')` が誤って含まれているため、該当買主はより低い優先度のカテゴリーに誤分類される。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type BuyerData
  OUTPUT: boolean

  RETURN equals(buyer.vendor_survey, '未')
         AND equals(buyer.broker_inquiry, '業者問合せ')
END FUNCTION
```

### Examples

- `vendor_survey = '未'`, `broker_inquiry = '業者問合せ'` → 現在: Priority 2 を返さない（バグ）、期待: `{ status: '業者問合せあり', priority: 2 }` を返す
- `vendor_survey = '未'`, `broker_inquiry = null` → 現在: Priority 2 を返す（正常）、期待: 変わらず Priority 2 を返す
- `vendor_survey = '未'`, `broker_inquiry = '業者（両手）'` → 現在: Priority 2 を返す（正常）、期待: 変わらず Priority 2 を返す
- `vendor_survey = '済'`, `broker_inquiry = '業者問合せ'` → 現在: Priority 2 を返さない（正常）、期待: 変わらず Priority 2 を返さない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `vendor_survey = '未'` かつ `broker_inquiry` が `'業者問合せ'` 以外（null、空文字、`'業者（両手）'` など）の場合は、引き続き `{ status: '業者問合せあり', priority: 2 }` を返す
- `valuation_survey` が入力済み かつ `valuation_survey_confirmed` が空欄の場合は、Priority 1（査定アンケート回答あり）が Priority 2 より優先される
- `vendor_survey` が `'未'` 以外（null、空文字、`'済'` など）の場合は、Priority 2 に分類しない

**Scope:**
`vendor_survey = '未'` かつ `broker_inquiry` が `'業者問合せ'` 以外の入力、および Priority 1 の判定ロジックは、この修正によって一切影響を受けない。

## Hypothesized Root Cause

1. **誤った除外条件の追加**: Priority 2 の条件に `!equals(buyer.broker_inquiry, '業者問合せ')` が含まれている。コメントにも「業者からの問合せ自体は除外」と記載されており、意図的に追加されたが仕様と異なる
   - 正しい仕様: `vendor_survey = '未'` であれば `broker_inquiry` の値に関係なく「業者問合せあり」を返す
   - 誤った実装: `broker_inquiry = '業者問合せ'` の場合を除外している

2. **仕様の誤解**: `broker_inquiry = '業者問合せ'` を「業者からの問合せ」と解釈し、「業者問合せあり」カテゴリーから除外すべきと誤って判断した可能性がある

## Correctness Properties

Property 1: Bug Condition - vendor_survey が '未' の場合は broker_inquiry に関係なく Priority 2 を返す

_For any_ buyer where `isBugCondition(buyer)` returns true（`vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'`）、かつ Priority 1 の条件を満たさない場合、修正後の `calculateBuyerStatus` 関数は `{ status: '業者問合せあり', priority: 2 }` を返す。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - broker_inquiry が '業者問合せ' 以外の場合の既存動作を保持する

_For any_ buyer where `isBugCondition(buyer)` returns false（`vendor_survey = '未'` かつ `broker_inquiry` が `'業者問合せ'` 以外、または `vendor_survey` が `'未'` 以外）、修正後の `calculateBuyerStatus` 関数は修正前と同じ結果を返し、既存の Priority 判定を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatus`

**Specific Changes**:

1. **Priority 2 の条件から除外条件を削除**: `!equals(buyer.broker_inquiry, '業者問合せ')` を削除する

**修正前:**
```typescript
// Priority 2: 業者問合せあり
// vendor_survey = '未' かつ broker_inquiry ≠ '業者問合せ'（業者からの問合せ自体は除外）
if (equals(buyer.vendor_survey, '未') && !equals(buyer.broker_inquiry, '業者問合せ')) {
  const status = '業者問合せあり';
  return { status, priority: 2, matchedCondition: '業者向けアンケート = 未', color: getStatusColor(status) };
}
```

**修正後:**
```typescript
// Priority 2: 業者問合せあり
// vendor_survey = '未' であれば broker_inquiry の値に関係なく「業者問合せあり」を返す
if (equals(buyer.vendor_survey, '未')) {
  const status = '業者問合せあり';
  return { status, priority: 2, matchedCondition: '業者向けアンケート = 未', color: getStatusColor(status) };
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現するテストを実行し、次に修正後のコードで Fix Checking と Preservation Checking を行う。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` の買主データで `calculateBuyerStatus` を呼び出し、Priority 2 が返らないことを確認する。

**Test Cases**:
1. **基本バグ再現**: `vendor_survey = '未'`, `broker_inquiry = '業者問合せ'` → Priority 2 が返らないことを確認（未修正コードで失敗）
2. **Priority 1 との組み合わせ**: `valuation_survey` 入力済み, `vendor_survey = '未'`, `broker_inquiry = '業者問合せ'` → Priority 1 が返ることを確認（未修正コードでも正常）
3. **broker_inquiry が null の場合**: `vendor_survey = '未'`, `broker_inquiry = null` → Priority 2 が返ることを確認（未修正コードでも正常）

**Expected Counterexamples**:
- `vendor_survey = '未'`, `broker_inquiry = '業者問合せ'` の入力で Priority 2 が返らず、より低い優先度のステータスが返る
- 原因: Priority 2 の条件に `!equals(buyer.broker_inquiry, '業者問合せ')` が含まれているため

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待動作を返すことを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := calculateBuyerStatus_fixed(buyer)
  ASSERT result.status = '業者問合せあり'
  ASSERT result.priority = 2
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT calculateBuyerStatus_original(buyer) = calculateBuyerStatus_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由:
- `broker_inquiry` の値域（null、空文字、各種文字列）を自動生成して網羅的に検証できる
- 手動テストでは見落としやすいエッジケースを検出できる
- 修正前後の動作が一致することを強く保証できる

**Test Cases**:
1. **broker_inquiry が null の場合の保持**: `vendor_survey = '未'`, `broker_inquiry = null` → 修正前後ともに Priority 2 を返すことを確認
2. **broker_inquiry が空文字の場合の保持**: `vendor_survey = '未'`, `broker_inquiry = ''` → 修正前後ともに Priority 2 を返すことを確認
3. **vendor_survey が '未' 以外の場合の保持**: `vendor_survey = '済'` など → 修正前後ともに Priority 2 を返さないことを確認
4. **Priority 1 優先順位の保持**: `valuation_survey` 入力済み → 修正前後ともに Priority 1 を返すことを確認

### Unit Tests

- `vendor_survey = '未'`, `broker_inquiry = '業者問合せ'` → `{ status: '業者問合せあり', priority: 2 }` を返すことを検証
- `vendor_survey = '未'`, `broker_inquiry = null` → `{ status: '業者問合せあり', priority: 2 }` を返すことを検証（既存動作の保持）
- `vendor_survey = '済'`, `broker_inquiry = '業者問合せ'` → Priority 2 を返さないことを検証
- Priority 1 条件と Priority 2 条件が重なる場合、Priority 1 が優先されることを検証

### Property-Based Tests

- `vendor_survey = '未'` かつ `broker_inquiry` が任意の値（null、空文字、任意の文字列）の場合、常に Priority 2 を返すことを検証（Property 1）
- `vendor_survey` が `'未'` 以外の任意の値の場合、Priority 2 を返さないことを検証（Property 2 の一部）
- `broker_inquiry` が `'業者問合せ'` 以外の任意の値 かつ `vendor_survey = '未'` の場合、修正前後で同じ結果を返すことを検証（Property 2）

### Integration Tests

- 買主リストのサイドバーで「業者問合せあり」カテゴリーに `broker_inquiry = '業者問合せ'` の買主が表示されることを確認
- `vendor_survey = '未'` の買主が `broker_inquiry` の値に関係なく「業者問合せあり」カテゴリーに分類されることを確認
- Priority 1（査定アンケート回答あり）の買主が「業者問合せあり」カテゴリーに表示されないことを確認
