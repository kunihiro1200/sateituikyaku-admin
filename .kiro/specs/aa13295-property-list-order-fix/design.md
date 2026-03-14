# aa13295-property-list-order-fix Bugfix Design

## Overview

物件リスト（`PropertyListingsPage`）のソート基準が誤っている。フロントエンドが `contract_date`（契約日）を `orderBy` パラメータとして渡しており、バックエンドの `PropertyListingService.getAll()` がそのままSupabaseに渡している。本来は `distribution_date`（配信日・公開日）の降順でソートし、`distribution_date` が空欄の物件はフォールバックとして `property_number` の降順で末尾に並べるべきである。

修正は最小限で、フロントエンドの `orderBy` パラメータ変更とバックエンドの `getAll()` メソッドのソートロジック修正の2箇所のみ。

## Glossary

- **Bug_Condition (C)**: `orderBy: 'contract_date'` がAPIに渡されている状態
- **Property (P)**: `distribution_date` の降順でソートされ、nullの場合は `property_number` の降順でフォールバックされること
- **Preservation**: フィルター・検索・ページネーション・詳細モーダルの既存動作が変わらないこと
- **getAll()**: `backend/src/services/PropertyListingService.ts` の物件一覧取得メソッド
- **distribution_date**: 物件の配信日・公開日。`property_listings` テーブルのカラム
- **contract_date**: 物件の契約日。ソート基準として誤って使用されていたカラム

## Bug Details

### Bug Condition

フロントエンドが `orderBy: 'contract_date'` をAPIパラメータとして渡しており、バックエンドがそのままSupabaseの `.order()` に渡している。`contract_date` が空欄の物件（AA13295など）は末尾に表示されてしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type APIRequest to /api/property-listings
  OUTPUT: boolean

  RETURN request.params.orderBy = 'contract_date'
         AND request.params.orderDirection = 'desc'
         AND correctSortField IS 'distribution_date'
END FUNCTION
```

### Examples

- AA13295: `distribution_date` が入力されているが `contract_date` が空欄 → 現在は末尾付近に表示される（バグ）、修正後は `distribution_date` の値に基づいて正しい位置に表示される
- `distribution_date` が空欄の物件 → 修正後は末尾に表示され、`property_number` の降順でフォールバックソートされる
- `distribution_date` が入力されている複数物件 → 修正後は配信日の新しい順に表示される

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- フィルター機能（担当者・ステータス・買主）は引き続き正常に動作する
- 検索機能（物件番号・住所・売主名）は引き続き正常に動作する
- ページネーション（全件取得のwhileループ）は引き続き正常に動作する
- 物件詳細モーダルの表示は引き続き正常に動作する

**Scope:**
ソートパラメータの変更のみが影響範囲。フィルタリング・検索・ページネーション・詳細表示のロジックは一切変更しない。

## Hypothesized Root Cause

1. **フロントエンドの誤ったorderByパラメータ**: `PropertyListingsPage.tsx` の101行目で `orderBy: 'contract_date'` を渡している。本来は `orderBy: 'distribution_date'` を渡すべき。

2. **バックエンドのgetAll()がorderByをそのまま使用**: `backend/src/services/PropertyListingService.ts` の99行目で `query.order(orderBy, ...)` とフロントエンドから受け取った値をそのまま使用している。バックエンド側でソートロジックをハードコードすることで、フロントエンドからの誤ったパラメータに依存しない実装にできる。

3. **distribution_dateがSELECT句に含まれていない**: `getAll()` のSELECT句に `distribution_date` と `contract_date` が含まれていないため、ソートに使用するためにSELECT句への追加も必要。

## Correctness Properties

Property 1: Bug Condition - distribution_date による降順ソート

_For any_ 物件リスト取得リクエストにおいて、バグ条件（`orderBy: 'contract_date'`）が成立する場合、修正後の `getAll()` は `distribution_date` の降順でソートされた結果を返し、`distribution_date` が null の物件は末尾に配置され `property_number` の降順でフォールバックソートされる。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - フィルター・検索・ページネーションの動作保持

_For any_ フィルター・検索・ページネーションを含むリクエストにおいて、バグ条件が成立しない（ソート以外のパラメータのみ変化する）場合、修正後の `getAll()` は修正前と同じフィルタリング・検索・ページネーション結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Line**: 101

**Specific Changes**:
1. **orderByパラメータの変更**: `orderBy: 'contract_date'` を `orderBy: 'distribution_date'` に変更する

```typescript
// 修正前
params: { limit, offset, orderBy: 'contract_date', orderDirection: 'desc' }

// 修正後
params: { limit, offset, orderBy: 'distribution_date', orderDirection: 'desc' }
```

---

**File 2**: `backend/src/services/PropertyListingService.ts`

**Method**: `getAll()`

**Specific Changes**:

1. **SELECT句に `distribution_date` と `contract_date` を追加**: ソートに使用するカラムをSELECT句に含める

```typescript
// 追加するカラム
distribution_date,
contract_date,
settlement_date,
```

2. **ソートロジックをハードコードに変更**: フロントエンドから受け取った `orderBy` パラメータをそのまま使うのではなく、`distribution_date` の降順 + `property_number` の降順フォールバックをバックエンド側で固定する

```typescript
// 修正前（99行目）
query = query.order(orderBy, { ascending: orderDirection === 'asc' });

// 修正後
query = query
  .order('distribution_date', { ascending: false, nullsFirst: false })
  .order('property_number', { ascending: false });
```

**注意**: `nullsFirst: false` を指定することで `distribution_date` が null の物件は末尾に配置される。その後 `property_number` の降順でフォールバックソートされる。

---

**File 3（同一ファイルの別コピー）**: `frontend/frontend/src/backend/services/PropertyListingService.ts`

このファイルは `backend/src/services/PropertyListingService.ts` と同じ内容のコピーが存在する。同様の修正を適用する。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `contract_date` ソートが使われていることを確認し、`distribution_date` ソートが使われていないことを示す。

**Test Plan**: `PropertyListingService.getAll()` に `orderBy: 'contract_date'` を渡したとき、`distribution_date` の降順になっていないことを確認する。

**Test Cases**:
1. **contract_dateソートテスト**: `orderBy: 'contract_date'` でAPIを呼び出し、`distribution_date` の降順になっていないことを確認（未修正コードで失敗するはず）
2. **AA13295表示位置テスト**: AA13295が一覧の先頭付近に表示されないことを確認（未修正コードで失敗するはず）
3. **null distribution_dateフォールバックテスト**: `distribution_date` がnullの物件が末尾に表示されないことを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- `contract_date` がnullの物件が末尾に表示される
- `distribution_date` の値に関係なく `contract_date` でソートされる

### Fix Checking

**Goal**: 修正後のコードで `distribution_date` の降順ソートが正しく機能することを検証する。

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := getAll_fixed(request)
  ASSERT result is sorted by distribution_date DESC (nulls last)
  ASSERT null distribution_date items are sorted by property_number DESC
END FOR
```

### Preservation Checking

**Goal**: ソート変更がフィルター・検索・ページネーションに影響しないことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT getAll_original(request).filters = getAll_fixed(request).filters
  ASSERT getAll_original(request).total = getAll_fixed(request).total
END FOR
```

**Testing Approach**: フィルター・検索・ページネーションのパラメータを変化させながら、結果の件数・フィルタリング結果が変わらないことをプロパティベーステストで検証する。

**Test Cases**:
1. **フィルター保持テスト**: `salesAssignee` フィルターを適用したとき、修正前後で同じ件数・同じ物件が返ることを確認
2. **検索保持テスト**: `search` パラメータを指定したとき、修正前後で同じ件数・同じ物件が返ることを確認
3. **ページネーション保持テスト**: `limit`・`offset` を変化させたとき、修正前後で同じ物件が返ることを確認

### Unit Tests

- `getAll()` に `orderBy: 'distribution_date'` を渡したとき、`distribution_date` の降順でソートされることを確認
- `distribution_date` がnullの物件が末尾に配置されることを確認
- `distribution_date` がnullの物件が `property_number` の降順でフォールバックソートされることを確認

### Property-Based Tests

- ランダムな `distribution_date` を持つ物件セットに対して、常に降順ソートが維持されることを検証
- `distribution_date` がnullの物件が常に末尾に配置されることを検証（任意の物件セットで）
- フィルターパラメータを変化させても、ソート順が常に `distribution_date` 降順であることを検証

### Integration Tests

- `PropertyListingsPage` を開いたとき、`distribution_date` の降順で物件が表示されることを確認
- AA13295が `distribution_date` の値に基づいて正しい位置に表示されることを確認
- フィルター・検索を適用した状態でも `distribution_date` 降順ソートが維持されることを確認
