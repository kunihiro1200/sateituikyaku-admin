# Bugfix Requirements Document

## Introduction

買主リストの「担当(Y) 3」サイドバーカテゴリにおいて、サイドバーに表示されるカウント数（3件）と、カテゴリをクリックした際に一覧表示される件数（0件、「データなし」と表示）が不一致となるバグが発生しています。

このバグにより、ユーザーは「担当(Y)」に該当する買主を正確に把握できず、業務効率が低下しています。

同様の問題が「内覧日前日」カテゴリでも発生しており、既に修正済みです（`.kiro/specs/buyer-viewing-day-before-filter-bug/`）。修正内容は `BuyerStatusCalculator.calculateBuyerStatus()` の判定ロジックをGASと完全一致させたものです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが買主リストページを開く THEN サイドバーに「担当(Y) 3」と表示され、カウントは3件である

1.2 WHEN ユーザーが「担当(Y) 3」カテゴリをクリックする THEN 一覧表示には「データなし」と表示され、0件が表示される

1.3 WHEN サイドバーカウントロジック（GAS）と一覧フィルタリングロジック（TypeScript）が異なる THEN カウント数と表示件数が不一致となる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが買主リストページを開く THEN サイドバーに「担当(Y) 3」と表示され、カウントは3件である

2.2 WHEN ユーザーが「担当(Y) 3」カテゴリをクリックする THEN 一覧表示にも正確に3件が表示される

2.3 WHEN サイドバーカウントロジック（GAS）と一覧フィルタリングロジック（TypeScript）が同じ THEN カウント数と表示件数が常に一致する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが他のサイドバーカテゴリ（「当日TEL」「内覧日前日」など）をクリックする THEN それらのカテゴリでは引き続き正しくフィルタリングされる

3.2 WHEN サイドバーカウントが `buyer_sidebar_counts` テーブルから取得される THEN 引き続き高速にカウントが表示される

3.3 WHEN 買主のステータスが `BuyerStatusCalculator.calculateBuyerStatus()` で計算される THEN 引き続き正しいステータスが計算される

## Bug Condition Analysis

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type { statusCategory: string }
  OUTPUT: boolean
  
  // 「担当(Y)」カテゴリをクリックした場合にバグが発生
  RETURN X.statusCategory = '担当(Y)'
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 担当(Y)カテゴリのフィルタリング
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCount ← getSidebarCount('担当(Y)')
  listResult ← getBuyersByStatus('担当(Y)')
  
  ASSERT sidebarCount = listResult.total
  ASSERT listResult.data の全ての買主が「担当(Y)」条件を満たす
  ASSERT listResult.data の全ての買主の follow_up_assignee = 'Y'
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 他のカテゴリは影響を受けない
FOR ALL X WHERE NOT isBugCondition(X) DO
  // 他のカテゴリ（「当日TEL」「内覧日前日」など）
  ASSERT F(X) = F'(X)
END FOR
```

ここで：
- **F**: 修正前の `BuyerStatusCalculator.calculateBuyerStatus()` メソッド
- **F'**: 修正後の `BuyerStatusCalculator.calculateBuyerStatus()` メソッド

## Technical Context

### Root Cause

**サイドバーカウント**（GAS）と**一覧フィルタリング**（TypeScript）で異なるロジックを使用しているため、カウント不一致が発生しています。

#### サイドバーカウントロジック（GAS）

- **データソース**: `buyer_sidebar_counts` テーブル（GASが10分ごとに更新）
- **計算ロジック**: GAS の `updateBuyerSidebarCounts_()` 関数
- **条件**（推測）:
  ```javascript
  // 担当(Y)の条件（GAS）
  follow_up_assignee === 'Y'
  ```

#### 一覧フィルタリングロジック（TypeScript）

- **メソッド**: `BuyerService.getBuyersByStatus()`
- **データソース**: `buyers` テーブルの全件を取得し、`calculated_status` でフィルタリング
- **計算ロジック**: `BuyerStatusCalculator.calculateBuyerStatus()`
- **条件**:
  ```typescript
  // Priority 23-30: 担当者別
  // Priority 37: 担当(イニシャル)
  if (isNotBlank(buyer.follow_up_assignee)) {
    const assignee = buyer.follow_up_assignee || '';
    
    // 内覧済み(Y) - Priority 36
    if (isNotBlank(buyer.viewing_date) && isPast(buyer.viewing_date)) {
      return { status: `内覧済み(${assignee})`, priority: 36, ... };
    }
    
    // 当日TEL(Y) - Priority 23-30
    if (isNotBlank(buyer.next_call_date) && isTodayOrPast(buyer.next_call_date)) {
      return { status: `当日TEL(${assignee})`, priority: 23, ... };
    }
    
    // 担当(Y) - Priority 37
    return { status: `担当(${assignee})`, priority: 37, ... };
  }
  ```

### Problem

**TypeScriptの `BuyerStatusCalculator` は、`follow_up_assignee = 'Y'` の買主を以下の3つのステータスに分類します**:

1. **`内覧済み(Y)`** - 内覧日が過去の場合（Priority 36）
2. **`当日TEL(Y)`** - 次電日が今日以前の場合（Priority 23-30）
3. **`担当(Y)`** - それ以外の場合（Priority 37）

**しかし、GASのサイドバーカウントは `follow_up_assignee = 'Y'` の全買主をカウントしています**。

**結果**: 
- サイドバーカウント: 3件（`follow_up_assignee = 'Y'` の全買主）
- 一覧表示: 0件（`calculated_status = '担当(Y)'` の買主のみ、他は `内覧済み(Y)` や `当日TEL(Y)` に分類されている）

### Affected Files

- `backend/src/services/BuyerService.ts` - `getBuyersByStatus()` メソッド
- `backend/src/services/BuyerStatusCalculator.ts` - `calculateBuyerStatus()` 関数
- `gas_buyer_complete_code.js` - `updateBuyerSidebarCounts_()` 関数（GAS）

## Counterexample

**具体例**:

- **サイドバーカウント**: 「担当(Y) 3」と表示（3件）
- **一覧表示**: 「データなし」と表示（0件）

**3件の内訳（推測）**:
1. 買主A: `follow_up_assignee = 'Y'`, `viewing_date` が過去 → `calculated_status = '内覧済み(Y)'`
2. 買主B: `follow_up_assignee = 'Y'`, `next_call_date` が今日以前 → `calculated_status = '当日TEL(Y)'`
3. 買主C: `follow_up_assignee = 'Y'`, 上記以外 → `calculated_status = '担当(Y)'`

**期待される動作**:

- **サイドバーカウント**: 「担当(Y) 3」と表示（3件）
- **一覧表示**: 3件が表示される（`内覧済み(Y)`, `当日TEL(Y)`, `担当(Y)` の全てを含む）

## Fix Strategy

### Option 1: 一覧フィルタリングロジックを修正（推奨）

`BuyerService.getBuyersByStatus()` メソッドを修正して、「担当(Y)」カテゴリをクリックした際に、`follow_up_assignee = 'Y'` の全買主を表示する（`calculated_status` に関係なく）。

**メリット**:
- サイドバーカウントロジック（GAS）は変更不要
- 「内覧日前日」バグ修正と同じアプローチ

**デメリット**:
- なし

### Option 2: サイドバーカウントロジックを修正

GAS の `updateBuyerSidebarCounts_()` 関数を修正して、`calculated_status = '担当(Y)'` の買主のみをカウントする。

**メリット**:
- TypeScriptのロジックは変更不要

**デメリット**:
- GASコードの修正が必要
- ユーザーの期待と異なる可能性（「担当(Y)」には `内覧済み(Y)` や `当日TEL(Y)` も含まれるべき）

### Recommended Approach

**Option 1（一覧フィルタリングロジックを修正）**を推奨します。

理由：
- サイドバーカウントは正しく計算されている（3件）
- 一覧フィルタリングが `calculated_status` のみでフィルタリングしているため、`内覧済み(Y)` や `当日TEL(Y)` が除外されている
- 「担当(Y)」カテゴリは、`follow_up_assignee = 'Y'` の全買主を表示すべき（親カテゴリとして）
- 修正範囲が限定的で、リスクが低い
