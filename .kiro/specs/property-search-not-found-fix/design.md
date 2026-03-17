# property-search-not-found-fix Bugfix Design

## Overview

物件リストページ（`PropertyListingsPage`）の検索バーで`AA9195`のような古い物件番号を入力しても「物件データが見つかりませんでした」と表示されるバグの修正。

根本原因は2つある：
1. フロントエンドの`fetchAllData`関数のページネーション終了条件が誤っており、全件取得が途中で止まる
2. バックエンドの`getAll`のSELECT文に`buyer_name`カラムが含まれておらず、買主名検索が機能しない

修正方針は最小限の変更で両方の原因を解消し、既存の検索・フィルタリング動作を保持する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `fetchAllData`が全件取得を途中で打ち切る、または`buyer_name`が`undefined`になる
- **Property (P)**: 期待される正しい動作 — 任意の物件番号・買主名で検索した際にDBに存在する物件が正しく表示される
- **Preservation**: 修正によって変更してはならない既存動作 — 物件一覧表示、サイドバーフィルタ、担当者フィルタ、ページ遷移、ページネーション
- **fetchAllData**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`内の関数。`limit=1000`でページネーションしながら全物件を取得する
- **getAll**: `backend/src/services/PropertyListingService.ts`内のメソッド。物件リストをDBから取得する
- **hasMore**: `fetchAllData`内のループ継続フラグ。`false`になるとループが終了する

## Bug Details

### Bug Condition

バグは2つの独立した条件で発現する。

**バグ1**: `fetchAllData`のページネーション終了条件が誤っており、`allListingsData.length >= listingsRes.data.total`という条件が`fetchedData.length < limit`と`OR`で結合されているため、取得件数がtotalに達する前にループが終了する可能性がある。

**バグ2**: `getAll`のSELECT文に`buyer_name`が含まれていないため、フロントエンドで`l.buyer_name`を参照すると常に`undefined`になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { searchQuery: string, allListingsData: PropertyListing[], total: number }
  OUTPUT: boolean

  // バグ1: ページネーション打ち切り
  IF input.allListingsData.length < input.total
     AND fetchAllDataStoppedEarly(input.allListingsData, input.total)
  THEN RETURN true

  // バグ2: buyer_name未取得
  IF input.searchQuery targets buyer_name
     AND input.allListingsData[*].buyer_name IS undefined
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- `AA9195`を検索 → 「物件データが見つかりませんでした」（DBには存在するが1000件目以降のため取得されない）
- 買主名「田中」を検索 → 結果なし（`buyer_name`が`undefined`のためフィルタが機能しない）
- `AA9195`を検索（修正後）→ 該当物件が正しく表示される
- 買主名「田中」を検索（修正後）→ 該当物件が正しく表示される

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 物件リストページを開いた際の物件一覧表示
- サイドバーステータスによるフィルタリング
- 担当者によるフィルタリング
- 物件行クリック時の物件詳細ページへの遷移
- ページネーション操作

**スコープ:**
検索バーへの入力に関係しない全ての操作（一覧表示、フィルタ、ページ遷移）は本修正の影響を受けない。

## Hypothesized Root Cause

調査済みの根本原因：

1. **ページネーション終了条件の誤り（バグ1）**: `fetchAllData`の終了条件が以下のようになっている
   ```typescript
   if (fetchedData.length < limit || allListingsData.length >= listingsRes.data.total) {
     hasMore = false;
   }
   ```
   `||`（OR）で結合されているため、`allListingsData.length >= total`が`true`になる前に`fetchedData.length < limit`が`true`になった場合（最終ページ以外でも）ループが終了する可能性がある。正しくは`fetchedData.length < limit`のみで判定すべき。

2. **SELECT文からのbuyerName欠落（バグ2）**: `backend/src/services/PropertyListingService.ts`の`getAll`メソッドのSELECT文に`buyer_name`カラムが含まれていない。フロントエンドは`l.buyer_name`を参照しているが、APIレスポンスに含まれないため常に`undefined`になる。

## Correctness Properties

Property 1: Bug Condition - 全件取得の完全性

_For any_ 物件総数`total`に対して`fetchAllData`を実行した場合、修正後の関数は`total`件全ての物件を取得する。`fetchedData.length < limit`のみを終了条件とすることで、最終ページ（`fetchedData.length < limit`）に達するまでループが継続する。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - buyer_name検索の正確性

_For any_ `buyer_name`を持つ物件に対して買主名で検索した場合、修正後のシステムは該当物件を正しく返す。`getAll`のSELECT文に`buyer_name`を追加することで、フロントエンドの`l.buyer_name`が正しい値を持つ。

**Validates: Requirements 2.3**

Property 3: Preservation - 既存フィルタリング動作の保持

_For any_ 検索バー入力以外の操作（サイドバーフィルタ、担当者フィルタ、ページネーション、行クリック）に対して、修正後のコードは修正前と同一の動作を示す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**修正1:**

**ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**関数**: `fetchAllData`

**変更内容**:
```typescript
// 修正前
if (fetchedData.length < limit || allListingsData.length >= listingsRes.data.total) {
  hasMore = false;
} else {
  offset += limit;
}

// 修正後
if (fetchedData.length < limit) {
  hasMore = false;
} else {
  offset += limit;
}
```

**理由**: `allListingsData.length >= listingsRes.data.total`の条件を削除し、最終ページ（`fetchedData.length < limit`）に達した場合のみループを終了する。

---

**修正2:**

**ファイル**: `backend/src/services/PropertyListingService.ts`

**関数**: `getAll`

**変更内容**: SELECT文に`buyer_name`を追加する。

**理由**: フロントエンドが`l.buyer_name`を参照しているが、APIレスポンスに含まれていないため`undefined`になっている。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現してカウンターエグザンプルを確認し、次に修正後のコードで全件取得と`buyer_name`検索が正しく動作することを検証する。

### Exploratory Bug Condition Checking

**目標**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**テスト計画**: `fetchAllData`のページネーションロジックをユニットテストで検証し、`total > limit`の場合に全件取得できないことを確認する。また、`getAll`のレスポンスに`buyer_name`が含まれないことを確認する。

**テストケース**:
1. **ページネーション打ち切りテスト**: `total=1500`、`limit=1000`の場合に`fetchAllData`が1000件で止まることを確認（未修正コードで失敗）
2. **buyer_name欠落テスト**: `getAll`のレスポンスに`buyer_name`が含まれないことを確認（未修正コードで失敗）
3. **古い物件番号検索テスト**: `AA9195`を検索して「見つかりません」が表示されることを確認（未修正コードで失敗）

**期待されるカウンターエグザンプル**:
- `total=1500`の場合、`fetchAllData`は1000件で終了し、残り500件が取得されない
- `buyer_name`フィールドが`undefined`のため、買主名フィルタが機能しない

### Fix Checking

**目標**: バグ条件が成立する全ての入力に対して、修正後の関数が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL total WHERE total > limit DO
  result := fetchAllData_fixed()
  ASSERT result.length == total
END FOR

FOR ALL listing WHERE listing.buyer_name IS NOT NULL DO
  result := getAll_fixed()
  ASSERT result.items[*].buyer_name IS NOT undefined
END FOR
```

### Preservation Checking

**目標**: バグ条件が成立しない全ての入力に対して、修正後のコードが修正前と同一の動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fetchAllData_original(input) = fetchAllData_fixed(input)
  ASSERT getAll_original(input) = getAll_fixed(input)
END FOR
```

**テスト計画**: 未修正コードでサイドバーフィルタ・担当者フィルタ・ページネーションの動作を観察し、修正後も同一動作を示すことをプロパティベーステストで検証する。

**テストケース**:
1. **サイドバーフィルタ保持**: サイドバーステータスフィルタが修正前後で同一結果を返すことを確認
2. **担当者フィルタ保持**: 担当者フィルタが修正前後で同一結果を返すことを確認
3. **ページネーション保持**: ページネーション操作が修正前後で同一動作を示すことを確認
4. **物件一覧表示保持**: ページ初期表示が修正前後で同一であることを確認

### Unit Tests

- `fetchAllData`のページネーションループが`fetchedData.length < limit`のみで終了することを検証
- `total`が`limit`の倍数の場合（エッジケース）に全件取得できることを検証
- `getAll`のレスポンスに`buyer_name`が含まれることを検証
- 買主名フィルタが`buyer_name`フィールドを正しく参照することを検証

### Property-Based Tests

- 任意の`total`（1〜5000）に対して`fetchAllData`が全件取得することを検証
- 任意の`buyer_name`を持つ物件リストに対して買主名検索が正しく機能することを検証
- 任意のフィルタ条件に対して修正前後で同一結果を返すことを検証

### Integration Tests

- 物件リストページを開いて全物件が表示されることを確認
- `AA9195`を検索して該当物件が表示されることを確認
- 買主名で検索して該当物件が表示されることを確認
- サイドバーフィルタ・担当者フィルタが引き続き正しく動作することを確認
