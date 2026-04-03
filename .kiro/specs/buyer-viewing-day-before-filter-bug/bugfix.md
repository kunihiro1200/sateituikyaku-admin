# Bugfix Requirements Document

## Introduction

買主リストの「内覧日前日３」サイドバーカテゴリにおいて、サイドバーに表示されるカウント数（3件）と、カテゴリをクリックした際に一覧表示される件数（全件）が不一致となるバグが発生しています。

このバグにより、ユーザーは「内覧日前日」に該当する買主を正確に把握できず、業務効率が低下しています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが買主リストページを開く THEN サイドバーに「内覧日前日３」と表示され、カウントは3件である

1.2 WHEN ユーザーが「内覧日前日３」カテゴリをクリックする THEN 一覧表示には3件ではなく全件（フィルタリングされていない状態）が表示される

1.3 WHEN サイドバーカウントロジックと一覧フィルタリングロジックが異なる THEN カウント数と表示件数が不一致となる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが買主リストページを開く THEN サイドバーに「内覧日前日３」と表示され、カウントは3件である

2.2 WHEN ユーザーが「内覧日前日３」カテゴリをクリックする THEN 一覧表示にも正確に3件のみが表示される

2.3 WHEN サイドバーカウントロジックと一覧フィルタリングロジックが同じ THEN カウント数と表示件数が常に一致する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが他のサイドバーカテゴリ（「当日TEL」「業者問合せあり」など）をクリックする THEN それらのカテゴリでは引き続き正しくフィルタリングされる

3.2 WHEN サイドバーカウントが `buyer_sidebar_counts` テーブルから取得される THEN 引き続き高速にカウントが表示される

3.3 WHEN 買主のステータスが `BuyerStatusCalculator.calculateBuyerStatus()` で計算される THEN 引き続き正しいステータスが計算される

## Bug Condition Analysis

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type { statusCategory: string }
  OUTPUT: boolean
  
  // 「内覧日前日」カテゴリをクリックした場合にバグが発生
  RETURN X.statusCategory = '内覧日前日'
END FUNCTION
```

### Property Specification

```pascal
// Property: Fix Checking - 内覧日前日カテゴリのフィルタリング
FOR ALL X WHERE isBugCondition(X) DO
  sidebarCount ← getSidebarCount('内覧日前日')
  listResult ← getBuyersByStatus('内覧日前日')
  
  ASSERT sidebarCount = listResult.total
  ASSERT listResult.data の全ての買主が「内覧日前日」条件を満たす
END FOR
```

### Preservation Goal

```pascal
// Property: Preservation Checking - 他のカテゴリは影響を受けない
FOR ALL X WHERE NOT isBugCondition(X) DO
  // 他のカテゴリ（「当日TEL」「業者問合せあり」など）
  ASSERT F(X) = F'(X)
END FOR
```

ここで：
- **F**: 修正前の `getBuyersByStatus()` メソッド
- **F'**: 修正後の `getBuyersByStatus()` メソッド

## Technical Context

### Root Cause

**サイドバーカウント**と**一覧フィルタリング**で異なるロジックを使用しているため、カウント不一致が発生しています。

#### サイドバーカウントロジック

- **データソース**: `buyer_sidebar_counts` テーブル（GASが10分ごとに更新）
- **計算ロジック**: GAS の `updateBuyerSidebarCounts_()` 関数
- **条件**:
  ```javascript
  // 内覧日前日の条件（GAS）
  isNotBlank(viewing_date) &&
  broker_inquiry !== '業者問合せ' &&
  isBlank(notification_sender) &&
  (
    (isTomorrow(viewing_date) && getDayOfWeek(viewing_date) !== '木曜日') ||
    (isDaysFromToday(viewing_date, 2) && getDayOfWeek(viewing_date) === '木曜日')
  )
  ```

#### 一覧フィルタリングロジック

- **メソッド**: `BuyerService.getBuyersByStatus()`
- **データソース**: `buyers` テーブルの全件を取得し、`calculated_status` でフィルタリング
- **計算ロジック**: `BuyerStatusCalculator.calculateBuyerStatus()`
- **条件**:
  ```typescript
  // 内覧日前日の条件（TypeScript）
  and(
    isNotBlank(buyer.viewing_date),
    not(equals(buyer.broker_inquiry, '業者問合せ')),
    isBlank(buyer.notification_sender),
    or(
      and(isTomorrow(buyer.viewing_date), not(equals(getDayOfWeek(buyer.viewing_date), '木曜日'))),
      and(isDaysFromToday(buyer.viewing_date, 2), equals(getDayOfWeek(buyer.viewing_date), '木曜日'))
    )
  )
  ```

### Problem

**サイドバーカウント**と**一覧フィルタリング**は同じ条件を使用していますが、以下の可能性があります：

1. **日付計算のタイミング差**: GASは10分ごとに更新されるため、リアルタイムの日付計算と差が生じる可能性
2. **データの不整合**: `buyer_sidebar_counts` テーブルと `buyers` テーブルのデータが同期されていない可能性
3. **フィルタリングロジックの実装ミス**: `getBuyersByStatus()` が正しく `calculated_status` でフィルタリングしていない可能性

### Affected Files

- `backend/src/services/BuyerService.ts` - `getBuyersByStatus()` メソッド
- `backend/src/services/BuyerStatusCalculator.ts` - `calculateBuyerStatus()` 関数
- `gas_buyer_complete_code.js` - `updateBuyerSidebarCounts_()` 関数（GAS）

## Counterexample

**具体例**:

- **サイドバーカウント**: 「内覧日前日３」と表示（3件）
- **一覧表示**: 全件が表示される（フィルタリングが効いていない）

**期待される動作**:

- **サイドバーカウント**: 「内覧日前日３」と表示（3件）
- **一覧表示**: 3件のみが表示される

## Fix Strategy

### Option 1: 一覧フィルタリングロジックを修正（推奨）

`BuyerService.getBuyersByStatus()` メソッドを修正して、`calculated_status` で正しくフィルタリングする。

**メリット**:
- サイドバーカウントロジック（GAS）は変更不要
- 既存の `BuyerStatusCalculator` を活用できる

**デメリット**:
- なし

### Option 2: サイドバーカウントロジックを修正

GAS の `updateBuyerSidebarCounts_()` 関数を修正して、TypeScript の `BuyerStatusCalculator` と完全に一致させる。

**メリット**:
- 根本的な原因を解決できる

**デメリット**:
- GASコードの修正が必要
- デプロイ手順が複雑

### Recommended Approach

**Option 1（一覧フィルタリングロジックを修正）**を推奨します。

理由：
- サイドバーカウントは正しく計算されている（3件）
- 一覧フィルタリングが正しく動作していない可能性が高い
- 修正範囲が限定的で、リスクが低い
