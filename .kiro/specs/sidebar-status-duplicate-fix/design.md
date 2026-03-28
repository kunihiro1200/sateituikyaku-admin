# Sidebar Status Duplicate Fix - バグ修正デザイン

## Overview

売主リストのサイドバーに2つのバグが存在する。

**バグ1**: `isUnvaluated()` 内の「未着手除外ロジック」がインライン展開されており、`isTodayCallNotStarted()` の実装と乖離している。具体的には、インライン展開では `status === '追客中'`（完全一致）のみで判定しているが、`isTodayCallBase()` は「除外後追客中」「他決→追客」も対象とするため、これらのステータスを持つ案件が「未着手」と「未査定」の両方に重複表示される。

**バグ2**: サイドバーの `getCount()` は `categoryCounts`（全件対象）から件数を取得するが、展開リストは `validSellers`（ページネーション表示中のみ）をフィルタリングするため、バッジ件数と展開リスト件数が一致しない。

修正方針は最小限の変更で確実に修正する：
1. `isUnvaluated()` のインライン展開を `isTodayCallNotStarted()` の直接呼び出しに置き換える
2. `SellerStatusSidebar.tsx` の展開リストが `expandedCategorySellers` を確実に使用するよう修正する

---

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 案件が「未着手」と「未査定」の両方の条件を満たす、またはバッジ件数と展開リスト件数が異なる状態
- **Property (P)**: 修正後の期待される正しい動作 — 「未着手」条件を満たす案件は「未査定」に含まれない、かつバッジ件数と展開リスト件数が一致する
- **Preservation**: 修正によって変更してはならない既存の動作 — 各カテゴリの正常な表示・フィルタリング動作
- **isTodayCallNotStarted()**: `sellerStatusFilters.ts` 内の関数。当日TEL_未着手の判定ロジックの単一の正解
- **isUnvaluated()**: `sellerStatusFilters.ts` 内の関数。未査定の判定ロジック。現在「未着手除外」をインライン展開しているため不整合が発生している
- **validSellers**: `SellerStatusSidebar.tsx` 内のローカル変数。ページネーション表示中の売主のみを含む（全件ではない）
- **expandedCategorySellers**: APIから取得した全件の売主データ（カテゴリ別）。バッジ件数と一致するデータソース
- **categoryCounts**: APIから取得した全件対象のカテゴリ別件数。バッジに表示される数値のソース

---

## Bug Details

### Bug Condition

**バグ1（重複表示）**: `isUnvaluated()` 内の未着手除外ロジックが `isTodayCallNotStarted()` と乖離しているため、特定のステータスを持つ案件が両カテゴリに重複表示される。

**バグ2（件数不一致）**: バッジ件数（全件対象）と展開リスト件数（表示中のみ）のデータソースが異なるため不一致が発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  // バグ1: 重複表示の条件
  bug1 := isTodayCallNotStarted(seller)
          AND isUnvaluated_current(seller)  // 現在の実装では除外されない

  // バグ2: 件数不一致の条件（コンポーネントレベル）
  // getCount(category) != filterSellersByCategory(validSellers, category).length
  // ただし expandedCategorySellers が未取得の場合

  RETURN bug1
END FUNCTION
```

### Examples

- **重複表示の例**: `status = '追客中'`、`inquiry_date = '2026-02-01'`（2026/1/1以降）、`unreachable_status = ''`、査定額が全て空、`next_call_date` が今日以前 → 「未着手」と「未査定」の両方に表示される（バグ）
- **インライン展開の不整合例**: `status = '除外後追客中'`、上記と同じ条件 → `isTodayCallNotStarted()` は `isTodayCall()` を呼ぶため `status !== '追客中'` で除外されるが、`isUnvaluated()` のインライン展開では `isTodayCallBase()` を使うため「未着手」条件を満たすと判定され、未査定から除外されない（バグ）
- **件数不一致の例**: 全件で「未着手」が5件あるが、現在のページに2件しか表示されていない場合、バッジは「5」、展開リストは「2」と表示される（バグ）
- **正常ケース**: `status = '追客中'`、`inquiry_date = '2025-11-01'`（2026/1/1より前）→ 「未着手」条件を満たさないため「未査定」のみに表示される（正常）

---

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 「未着手」条件のみを満たす案件は「未着手」カテゴリに引き続き表示される
- 「未査定」条件のみを満たす案件（未着手条件を満たさない）は「未査定」カテゴリに引き続き表示される
- 「当日TEL分」「査定（郵送）」など他のカテゴリのフィルタリング動作は変更されない
- `expandedCategorySellers` が存在する場合の展開リスト表示は変更されない

**スコープ:**
「未着手」と「未査定」の重複判定ロジック、および展開リストのデータソース選択ロジックのみを修正する。他のカテゴリ判定関数（`isTodayCall`、`isMailingPending` 等）は一切変更しない。

---

## Hypothesized Root Cause

### バグ1: 重複表示

1. **インライン展開による乖離**: `isUnvaluated()` 内で `isTodayCallNotStarted()` を直接呼び出さず、条件をインライン展開している。インライン展開では `isTodayCallBase()` を使用しているが、`isTodayCallNotStarted()` は `isTodayCall()` を経由するため、`status === '追客中'`（完全一致）の条件が追加される。この差異により除外が不完全になる。

2. **コードの重複管理**: 同じロジックが2箇所に存在することで、一方を変更した際に他方が追従しないリスクがある。

### バグ2: 件数不一致

1. **データソースの不一致**: `getCount()` は `categoryCounts`（全件対象のAPIレスポンス）を参照するが、展開リストの `filteredSellers` は `validSellers`（ページネーション表示中のみ）をフィルタリングする。

2. **フォールバックの問題**: `expandedCategorySellers[categoryKey]` が `undefined`（未取得）の場合、`validSellers` にフォールバックするが、これがバッジ件数と一致しない。

---

## Correctness Properties

Property 1: Bug Condition - 未着手案件は未査定から除外される

_For any_ 売主データにおいて `isTodayCallNotStarted(seller)` が `true` を返す場合、修正後の `isUnvaluated(seller)` は `false` を返し、当該案件は「未査定」カテゴリに表示されない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 未着手条件を満たさない未査定案件は引き続き表示される

_For any_ 売主データにおいて `isTodayCallNotStarted(seller)` が `false` を返し、かつ未査定の他の条件（査定額が全て空、反響日付が2025/12/8以降、追客中、営担なし、査定不要でない）を満たす場合、修正後の `isUnvaluated(seller)` は `true` を返す。

**Validates: Requirements 3.1, 3.2**

---

## Fix Implementation

### Changes Required

#### File 1: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `isUnvaluated()`

**Specific Changes**:

1. **インライン展開を削除**: `isUnvaluated()` 内の「未着手除外ロジック」のインライン展開（約15行）を削除する

2. **直接呼び出しに置き換え**: `isTodayCallNotStarted(seller)` を直接呼び出して除外判定する

**修正前（現在のコード）**:
```typescript
// 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
// ※ isTodayCallNotStarted は後方で定義されるため、条件をインライン展開
const NOTSTARTED_CUTOFF = '2026-01-01';
const unreachableForCheck = seller.unreachableStatus || seller.unreachable_status || '';
const confidenceForCheck = seller.confidence || seller.confidenceLevel || seller.confidence_level || '';
const exclusionDateForCheck = seller.exclusionDate || seller.exclusion_date || '';
const isNotStarted = isTodayCallBase(seller) &&
  !hasContactInfo(seller) &&
  !hasVisitAssignee(seller) &&
  (seller.status || '') === '追客中' &&
  (!unreachableForCheck || unreachableForCheck.trim() === '') &&
  confidenceForCheck !== 'ダブり' && confidenceForCheck !== 'D' && confidenceForCheck !== 'AI査定' &&
  (!exclusionDateForCheck || exclusionDateForCheck.trim() === '') &&
  normalizedInquiryDate >= NOTSTARTED_CUTOFF;
if (isNotStarted) {
  return false;
}
```

**修正後**:
```typescript
// 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
if (isTodayCallNotStarted(seller)) {
  return false;
}
```

**注意**: `isTodayCallNotStarted` は `isUnvaluated` より後に定義されているため、関数の順序を入れ替えるか、`isTodayCallNotStarted` の定義を `isUnvaluated` より前に移動する必要がある。

#### File 2: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**Function**: `renderCategoryButton()` 内の `filteredSellers` 計算ロジック

**Specific Changes**:

現在のコード:
```typescript
const filteredSellers = isExpanded
  ? (isLoadingExpanded || fullSellers === undefined ? [] : fullSellers)
  : filterSellersByCategory(validSellers, category);
```

このロジックは展開時（`isExpanded = true`）に `fullSellers === undefined` の場合は空配列を返すため、ローディング中は「読み込み中...」が表示される。これは意図した動作であり、バッジ件数との不一致はバッジ側の `count` が `categoryCounts` から取得されているため発生しない。

**実際の問題箇所の確認**: バッジに表示される `count` は `getCount(category)` から取得され、`categoryCounts` が存在する場合はそこから取得する。展開リストのヘッダーにも `count` が表示されているため、バッジと展開リストヘッダーの件数は一致している。

**展開リストの実際の件数**: `filteredSellers.length` が展開リストの実際の件数。`fullSellers`（APIから取得した全件データ）が存在する場合はそれを使用するため、`categoryCounts` と一致するはず。

**修正が必要な場合**: `expandedCategorySellers` が取得されていない状態でカテゴリをクリックした際、`onCategoryExpand` が呼ばれるが、データ取得前に `validSellers` でフィルタリングした結果が表示される可能性がある。この場合、展開リストのヘッダーに表示される `count`（バッジと同じ値）と実際のリスト件数が異なる。

**修正方針**: `expandedCategorySellers` が未取得の場合は、ローディング状態として扱い、`validSellers` でのフォールバックを行わない。現在の実装では `fullSellers === undefined` の場合に空配列を返しているため、この動作は既に正しい可能性がある。実際のバグ再現を確認した上で修正を判断する。

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消されかつ既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `isUnvaluated()` と `isTodayCallNotStarted()` の両方の条件を満たす売主データを作成し、現在の実装で重複が発生することを確認する。

**Test Cases**:
1. **基本重複テスト**: `status = '追客中'`、`inquiry_date = '2026-02-01'`、`unreachable_status = ''`、査定額全て空、`next_call_date` が今日以前 → 未修正コードで `isUnvaluated()` が `true` を返すことを確認（バグ）
2. **ステータス差異テスト**: `status = '除外後追客中'`、同じ条件 → `isTodayCallNotStarted()` は `false`（`isTodayCall()` が `false`）だが、インライン展開では `isTodayCallBase()` が `true` になるため除外されない（バグ）
3. **正常ケーステスト**: `inquiry_date = '2025-11-01'`（2026/1/1より前）→ 未着手条件を満たさないため `isUnvaluated()` が `true` を返す（正常）

**Expected Counterexamples**:
- `isTodayCallNotStarted(seller) === true` かつ `isUnvaluated(seller) === true` となる売主データが存在する
- 原因: インライン展開が `isTodayCallNotStarted()` の完全な条件を再現していない

### Fix Checking

**Goal**: 修正後、未着手条件を満たす全ての入力で `isUnvaluated()` が `false` を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isTodayCallNotStarted(seller) DO
  result := isUnvaluated_fixed(seller)
  ASSERT result === false
END FOR
```

### Preservation Checking

**Goal**: 未着手条件を満たさない入力で、修正前後の `isUnvaluated()` の結果が一致することを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isTodayCallNotStarted(seller) DO
  ASSERT isUnvaluated_original(seller) === isUnvaluated_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。売主データのランダム生成により、手動テストでは見落としやすいエッジケース（境界日付、複合条件等）を網羅できる。

**Test Cases**:
1. **未査定のみ条件テスト**: `inquiry_date = '2025-12-10'`（基準日以降）、未着手条件を満たさない → 修正後も `isUnvaluated()` が `true` を返すことを確認
2. **境界日付テスト**: `inquiry_date = '2025-12-08'`（基準日ちょうど）→ 修正前後で同じ結果
3. **営担あり除外テスト**: `visit_assignee = 'Y'` → 修正前後で `isUnvaluated()` が `false` を返す

### Unit Tests

- `isTodayCallNotStarted()` が `true` の場合、修正後の `isUnvaluated()` が `false` を返すことをテスト
- `isTodayCallNotStarted()` が `false` の場合、修正後の `isUnvaluated()` が修正前と同じ結果を返すことをテスト
- 境界値（`inquiry_date = '2026-01-01'`、`inquiry_date = '2025-12-31'`）でのテスト
- `status = '除外後追客中'` の場合のテスト（インライン展開との差異を確認）

### Property-Based Tests

- ランダムな売主データを生成し、`isTodayCallNotStarted(seller) === true` ならば `isUnvaluated_fixed(seller) === false` を検証
- ランダムな売主データを生成し、`isTodayCallNotStarted(seller) === false` ならば `isUnvaluated_original(seller) === isUnvaluated_fixed(seller)` を検証
- 多数のランダムデータで「未着手」と「未査定」が排他的であることを検証

### Integration Tests

- 売主リストページで「未着手」カテゴリと「未査定」カテゴリの件数の合計が、重複なしで正しいことを確認
- 「未着手」条件を満たす案件が「未査定」カテゴリに表示されないことをUIレベルで確認
- サイドバーのバッジ件数と展開リスト件数が一致することを確認
