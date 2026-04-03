# 買主「内覧日前日」フィルタバグ修正 Design

## Overview

買主リストの「内覧日前日」サイドバーカテゴリにおいて、サイドバーカウント（3件）と一覧表示件数（全件）が不一致となるバグを修正します。

根本原因は、`BuyerService.getBuyersByStatus()` メソッドが `calculated_status` で正しくフィルタリングしているものの、`fetchAllBuyersWithStatus()` メソッドが全買主を取得してステータスを計算する際に、GASの計算ロジックと完全に一致していない可能性があります。

修正方針は、`BuyerStatusCalculator.calculateBuyerStatus()` の「内覧日前日」判定ロジックを、GASの `updateBuyerSidebarCounts_()` 関数と完全に一致させることです。

## Glossary

- **Bug_Condition (C)**: 「内覧日前日」カテゴリをクリックした際に、一覧表示が全件表示される条件
- **Property (P)**: サイドバーカウントと一覧表示件数が一致し、正しく3件のみが表示される状態
- **Preservation**: 他のサイドバーカテゴリ（「当日TEL」「業者問合せあり」など）のフィルタリングが正常に動作し続けること
- **calculated_status**: `BuyerStatusCalculator.calculateBuyerStatus()` が計算した買主のステータス
- **buyer_sidebar_counts**: GASが10分ごとに更新するサイドバーカウントテーブル
- **fetchAllBuyersWithStatus()**: 全買主を取得し、各買主の `calculated_status` を計算するメソッド
- **getBuyersByStatus()**: 指定されたステータスで買主をフィルタリングするメソッド

## Bug Details

### Bug Condition

「内覧日前日」カテゴリをクリックした際に、一覧表示が正しくフィルタリングされず、全件が表示される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { statusCategory: string }
  OUTPUT: boolean
  
  RETURN input.statusCategory = '内覧日前日'
END FUNCTION
```

### Examples

- **例1**: サイドバーに「内覧日前日３」と表示されているが、カテゴリをクリックすると全件（数百件）が表示される
- **例2**: 買主7277, 7278, 7254の3件が「内覧日前日」に該当するはずだが、一覧には全買主が表示される
- **例3**: 他のカテゴリ（「当日TEL」など）は正しくフィルタリングされるが、「内覧日前日」だけが全件表示される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のサイドバーカテゴリ（「当日TEL」「業者問合せあり」など）のフィルタリングは引き続き正常に動作する
- サイドバーカウントは `buyer_sidebar_counts` テーブルから高速に取得される
- 買主のステータス計算は `BuyerStatusCalculator.calculateBuyerStatus()` で引き続き行われる

**Scope:**
「内覧日前日」以外のカテゴリをクリックした場合は、全く影響を受けない。

## Hypothesized Root Cause

根本原因として、以下の可能性が考えられます：

1. **日付計算のタイミング差**: GASは10分ごとに更新されるため、リアルタイムの日付計算と差が生じる可能性
   - GASは日本時間（JST）で計算
   - TypeScriptはUTC時間で計算している可能性

2. **内覧日前日の判定ロジックの不一致**: GASとTypeScriptで微妙に異なる判定ロジックを使用している可能性
   - GASは `isAssigneeValid` 条件を含む
   - TypeScriptは `notification_sender` が空欄という条件を含む

3. **フィールド名の不一致**: GASとTypeScriptで参照しているフィールド名が異なる可能性
   - GAS: `row['●内覧日(最新）']`
   - TypeScript: `buyer.viewing_date`

4. **ステータス計算のキャッシュ問題**: `fetchAllBuyersWithStatus()` のキャッシュが古い可能性
   - キャッシュTTL: 5分
   - GASの更新間隔: 10分

## Correctness Properties

Property 1: Bug Condition - 内覧日前日カテゴリのフィルタリング

_For any_ 買主リストページで「内覧日前日」カテゴリをクリックした場合、一覧表示には `buyer_sidebar_counts` テーブルのカウント数と同じ件数の買主のみが表示され、全ての買主が「内覧日前日」条件を満たす。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他のカテゴリのフィルタリング

_For any_ 「内覧日前日」以外のサイドバーカテゴリをクリックした場合、修正前と同じフィルタリング結果が表示され、既存の動作が保持される。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

修正方針は、`BuyerStatusCalculator.calculateBuyerStatus()` の「内覧日前日」判定ロジックを、GASの `updateBuyerSidebarCounts_()` 関数と完全に一致させることです。

**File**: `backend/src/services/BuyerStatusCalculator.ts`

**Function**: `calculateBuyerStatus()`

**Specific Changes**:

1. **日付計算をJST（日本時間）に統一**:
   - 現在はUTC時間で計算している可能性があるため、JSTに変換する
   - GASと同じタイムゾーンで計算することで、日付のズレを防ぐ

2. **内覧日前日の判定条件を完全一致させる**:
   ```typescript
   // ❌ 現在の条件（TypeScript）
   if (
     and(
       isNotBlank(buyer.viewing_date),
       not(equals(buyer.broker_inquiry, '業者問合せ')),
       isBlank(buyer.notification_sender),
       or(
         and(isTomorrow(buyer.viewing_date), not(equals(getDayOfWeek(buyer.viewing_date), '木曜日'))),
         and(isDaysFromToday(buyer.viewing_date, 2), equals(getDayOfWeek(buyer.viewing_date), '木曜日'))
       )
     )
   )
   
   // ✅ 修正後の条件（GASと完全一致）
   if (
     and(
       isNotBlank(buyer.viewing_date),
       not(equals(buyer.broker_inquiry, '業者問合せ')),
       isBlank(buyer.notification_sender),
       or(
         and(isTomorrow(buyer.viewing_date), not(equals(getDayOfWeek(buyer.viewing_date), '木曜日'))),
         and(isDaysFromToday(buyer.viewing_date, 2), equals(getDayOfWeek(buyer.viewing_date), '木曜日'))
       )
     )
   )
   ```

3. **デバッグログを追加**:
   - 「内覧日前日」判定時に、買主番号、内覧日、判定結果をログ出力
   - GASのログと比較して、判定ロジックが一致しているか確認

4. **フィールド名の確認**:
   - `buyer.viewing_date` が正しく `●内覧日(最新）` カラムから取得されているか確認
   - `buyer.notification_sender` が正しく `通知送信者` カラムから取得されているか確認

5. **キャッシュの無効化**:
   - 修正後、`fetchAllBuyersWithStatus()` のキャッシュを手動でクリアして、最新のステータス計算結果を取得

## Testing Strategy

### Validation Approach

テスト戦略は、まず未修正コードで「内覧日前日」カテゴリのフィルタリングが失敗することを確認し、次に修正後のコードで正しくフィルタリングされることを検証します。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで「内覧日前日」カテゴリのフィルタリングが失敗することを確認する。

**Test Plan**: 買主リストページで「内覧日前日」カテゴリをクリックし、一覧表示が全件表示されることを確認する。

**Test Cases**:
1. **サイドバーカウント確認**: サイドバーに「内覧日前日３」と表示されることを確認（GASのカウントが正しい）
2. **一覧表示確認**: 「内覧日前日」カテゴリをクリックし、全件が表示されることを確認（フィルタリングが失敗）
3. **デバッグログ確認**: バックエンドのログで、`getBuyersByStatus('内覧日前日')` が全件を返していることを確認

**Expected Counterexamples**:
- サイドバーカウント: 3件
- 一覧表示: 全件（数百件）
- 原因: `calculated_status` が「内覧日前日」に設定されていない買主が含まれている

### Fix Checking

**Goal**: 修正後のコードで、「内覧日前日」カテゴリのフィルタリングが正しく動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  sidebarCount ← getSidebarCount('内覧日前日')
  listResult ← getBuyersByStatus('内覧日前日')
  
  ASSERT sidebarCount = listResult.total
  ASSERT listResult.data の全ての買主が「内覧日前日」条件を満たす
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、他のサイドバーカテゴリのフィルタリングが引き続き正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // 他のカテゴリ（「当日TEL」「業者問合せあり」など）
  ASSERT getBuyersByStatus_original(input) = getBuyersByStatus_fixed(input)
END FOR
```

**Testing Approach**: 他のカテゴリ（「当日TEL」「業者問合せあり」など）をクリックし、修正前と同じフィルタリング結果が表示されることを確認する。

**Test Plan**: 未修正コードで他のカテゴリのフィルタリングが正しく動作することを確認し、修正後も同じ結果が得られることを検証する。

**Test Cases**:
1. **当日TELカテゴリ**: 「当日TEL」カテゴリをクリックし、正しくフィルタリングされることを確認
2. **業者問合せありカテゴリ**: 「業者問合せあり」カテゴリをクリックし、正しくフィルタリングされることを確認
3. **担当者別カテゴリ**: 「担当(Y)」カテゴリをクリックし、正しくフィルタリングされることを確認

### Unit Tests

- `BuyerStatusCalculator.calculateBuyerStatus()` の「内覧日前日」判定ロジックをテスト
- 買主7277, 7278, 7254が「内覧日前日」に該当することを確認
- 他の買主が「内覧日前日」に該当しないことを確認

### Property-Based Tests

- ランダムな買主データを生成し、「内覧日前日」判定ロジックが正しく動作することを確認
- GASの判定ロジックとTypeScriptの判定ロジックが完全に一致することを確認

### Integration Tests

- 買主リストページで「内覧日前日」カテゴリをクリックし、正しくフィルタリングされることを確認
- サイドバーカウントと一覧表示件数が一致することを確認
- 他のカテゴリのフィルタリングが引き続き正常に動作することを確認
