# seller-sidebar-category-duplicate-fix バグ修正設計

## Overview

売主リストのサイドバーにおいて、「当日TEL_未着手」（`todayCallNotStarted`）カテゴリーに該当する売主が「当日TEL分」（`todayCall`）カテゴリーにも重複して表示されるバグを修正する。

`isTodayCallNotStarted` は `isTodayCall` のサブセットとして定義されているため、`filterSellersByCategory` の `todayCall` ケースで `isTodayCall` をそのまま使うと、`isTodayCallNotStarted` 該当者も含まれてしまう。修正方針は `todayCall` フィルターから `isTodayCallNotStarted` 該当者を除外し、「未着手」を優先させることである。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `isTodayCallNotStarted(seller) === true` かつ `filterSellersByCategory(sellers, 'todayCall')` の結果にその売主が含まれている状態
- **Property (P)**: 期待される正しい動作 — `todayCall` カテゴリーのフィルタリング結果に `isTodayCallNotStarted` 該当者が含まれないこと
- **Preservation**: 修正によって変えてはいけない既存の動作 — `todayCallNotStarted` カテゴリーのフィルタリング結果、および `todayCall` 以外の全カテゴリーのフィルタリング結果
- **filterSellersByCategory**: `frontend/frontend/src/utils/sellerStatusFilters.ts` の関数。売主リストを指定カテゴリーでフィルタリングして返す
- **isTodayCall**: 「当日TEL分」の判定関数。追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし
- **isTodayCallNotStarted**: 「当日TEL_未着手」の判定関数。`isTodayCall` の条件を全て満たした上で、不通が空欄 + 反響日付が2026/1/1以降 + 状況が「追客中」（完全一致）+ 確度が「ダブり」「D」「AI査定」でない

## Bug Details

### Bug Condition

`isTodayCallNotStarted` は `isTodayCall` を内部で呼び出しており、`isTodayCall` が `true` であることを前提としている。そのため `filterSellersByCategory` の `todayCall` ケースで `isTodayCall` をそのまま使うと、`isTodayCallNotStarted` 該当者も必ず含まれてしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  RETURN isTodayCallNotStarted(seller) === true
         AND filterSellersByCategory([seller], 'todayCall').includes(seller)
END FUNCTION
```

### Examples

- 売主A: 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=空、反響日付=2026/2/1
  - `isTodayCallNotStarted` → true
  - 修正前: `todayCall` カテゴリーに表示される（バグ）
  - 修正後: `todayCall` カテゴリーに表示されない（正しい）

- 売主B: 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=「不通」、反響日付=2026/2/1
  - `isTodayCallNotStarted` → false（不通が空欄でないため）
  - 修正前後ともに `todayCall` カテゴリーに表示される（変化なし）

- 売主C: 状況=「他決→追客」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=空、反響日付=2026/2/1
  - `isTodayCallNotStarted` → false（状況が「追客中」完全一致でないため）
  - 修正前後ともに `todayCall` カテゴリーに表示される（変化なし）

- 売主D: 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=空、反響日付=2025/12/31
  - `isTodayCallNotStarted` → false（反響日付が2026/1/1未満のため）
  - 修正前後ともに `todayCall` カテゴリーに表示される（変化なし）

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作:**
- `todayCallNotStarted` カテゴリーのフィルタリング結果は変わらない（`isTodayCallNotStarted` 該当者は引き続き表示される）
- `todayCall` カテゴリーには、`isTodayCallNotStarted` に該当しない `isTodayCall` 該当者が引き続き表示される
- `todayCall` の条件を満たさない売主は引き続き `todayCall` カテゴリーに表示されない
- `all` カテゴリーは全売主を返す（変化なし）
- `todayCallWithInfo`、`visitDayBefore`、`visitCompleted`、`unvaluated`、`mailingPending`、`pinrichEmpty`、`exclusive`、`general` など、`todayCall` 以外の全カテゴリーのフィルタリング結果は変わらない

**スコープ:**
修正対象は `filterSellersByCategory` 関数の `todayCall` ケースのみ。他のケースは一切変更しない。

## Hypothesized Root Cause

`filterSellersByCategory` の `todayCall` ケースが `isTodayCall` をそのまま使用しており、`isTodayCallNotStarted` 該当者を除外する排他制御がない。

```typescript
// 現在の実装（バグあり）
case 'todayCall':
  return sellers.filter(isTodayCall);  // isTodayCallNotStarted 該当者も含まれてしまう
```

`isTodayCallNotStarted` は `isTodayCall` のサブセットとして設計されているため（内部で `isTodayCall` を呼び出している）、`isTodayCall` が `true` の売主は必ず `isTodayCallNotStarted` の判定対象になる。「未着手」を優先させるには、`todayCall` フィルターで `isTodayCallNotStarted` 該当者を明示的に除外する必要がある。

## Correctness Properties

Property 1: Bug Condition - 当日TEL_未着手該当者は当日TEL分に含まれない

_For any_ 売主において `isTodayCallNotStarted(seller)` が `true` を返す場合、修正後の `filterSellersByCategory(sellers, 'todayCall')` はその売主を結果に含めてはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 当日TEL_未着手非該当者の当日TEL分表示は変わらない

_For any_ 売主において `isTodayCallNotStarted(seller)` が `false` かつ `isTodayCall(seller)` が `true` の場合、修正後の `filterSellersByCategory(sellers, 'todayCall')` はその売主を結果に含めなければならない（修正前と同じ動作）。

**Validates: Requirements 3.2, 3.3**

Property 3: Preservation - 当日TEL_未着手カテゴリーは変わらない

_For any_ 売主リストに対して、修正後の `filterSellersByCategory(sellers, 'todayCallNotStarted')` は修正前と同じ結果を返さなければならない。

**Validates: Requirements 3.1**

Property 4: Preservation - 他カテゴリーは変わらない

_For any_ 売主リストと `todayCall` 以外のカテゴリー `c` に対して、修正後の `filterSellersByCategory(sellers, c)` は修正前と同じ結果を返さなければならない。

**Validates: Requirements 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `filterSellersByCategory`

**Specific Changes:**

1. **`todayCall` ケースに除外ロジックを追加**: `isTodayCall` が `true` かつ `isTodayCallNotStarted` が `false` の売主のみを返すように変更する

```typescript
// 修正前
case 'todayCall':
  return sellers.filter(isTodayCall);

// 修正後
case 'todayCall':
  return sellers.filter(s => isTodayCall(s) && !isTodayCallNotStarted(s));
```

変更箇所はこの1行のみ。他のケースは一切変更しない。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現するテストを書いて失敗を確認し、次に修正後のコードでテストが通ることと既存動作が保たれることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `isTodayCallNotStarted` の条件を全て満たす売主を作成し、`filterSellersByCategory(sellers, 'todayCall')` の結果にその売主が含まれることを確認する（未修正コードでは失敗するはず）。

**Test Cases:**
1. **基本ケース**: 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=空、反響日付=2026/2/1 の売主が `todayCall` に含まれることを確認（未修正コードでは含まれてしまう）
2. **境界値ケース**: 反響日付=2026/1/1（カットオフ日当日）の売主が `todayCall` に含まれることを確認
3. **複数売主ケース**: `isTodayCallNotStarted` 該当者と非該当者が混在するリストで、該当者が `todayCall` に含まれることを確認

**Expected Counterexamples:**
- `filterSellersByCategory(sellers, 'todayCall')` が `isTodayCallNotStarted` 該当者を返してしまう
- 原因: `todayCall` ケースが `isTodayCall` のみで判定しており、`isTodayCallNotStarted` の除外がない

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全入力に対して期待動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := filterSellersByCategory([seller], 'todayCall')
  ASSERT result.length === 0  // 当日TEL_未着手該当者は含まれない
END FOR
```

### Preservation Checking

**Goal**: 修正後、バグ条件を満たさない入力に対して修正前と同じ動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT filterSellersByCategory_original([seller], 'todayCall')
       = filterSellersByCategory_fixed([seller], 'todayCall')
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。ランダムな売主データを大量生成して、修正前後の動作が一致することを確認できる。

**Test Cases:**
1. **Preservation Test 1**: `isTodayCall` が `true` かつ `isTodayCallNotStarted` が `false` の売主が `todayCall` に引き続き含まれることを確認
2. **Preservation Test 2**: `isTodayCallNotStarted` 該当者が `todayCallNotStarted` カテゴリーに引き続き含まれることを確認
3. **Preservation Test 3**: `todayCallWithInfo`、`visitDayBefore` など他カテゴリーの結果が変わらないことを確認

### Unit Tests

- `isTodayCallNotStarted` 該当者が `todayCall` に含まれないことを確認
- `isTodayCallNotStarted` 非該当の `isTodayCall` 該当者が `todayCall` に含まれることを確認
- `isTodayCallNotStarted` 該当者が `todayCallNotStarted` に引き続き含まれることを確認
- 境界値（反響日付=2026/1/1、反響日付=2025/12/31）のテスト

### Property-Based Tests

- ランダムな売主データに対して Property 1 を検証（`isTodayCallNotStarted` 該当者は `todayCall` に含まれない）
- ランダムな売主データに対して Property 2 を検証（`isTodayCallNotStarted` 非該当の `isTodayCall` 該当者は `todayCall` に含まれる）
- ランダムな売主データに対して Property 3 を検証（`todayCallNotStarted` カテゴリーの結果が変わらない）
- ランダムなカテゴリーと売主データに対して Property 4 を検証（他カテゴリーの結果が変わらない）

### Integration Tests

- サイドバーカウント（`getCategoryCounts`）と `filterSellersByCategory` の結果が一致することを確認
- `todayCall` と `todayCallNotStarted` のカウントの合計が、修正前の `todayCall` カウントと一致することを確認（重複がなくなったことの検証）
