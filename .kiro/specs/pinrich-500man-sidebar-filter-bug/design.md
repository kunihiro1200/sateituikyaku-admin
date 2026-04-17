# Pinrich500万以上登録未サイドバーフィルターバグ 修正設計

## Overview

買主リストのサイドバーカテゴリー「Pinrich500万以上登録未」をクリックすると、
条件を満たす買主が存在するにもかかわらず空のリスト（0件）が表示されるバグ。

`fetchAllBuyers()` が取得するカラムリスト（`BUYER_COLUMNS`）に `pinrich_500man_registration` が
含まれておらず、かつ `property_listings` クエリに `price` カラムが含まれていないため、
`getBuyersByStatus('pinrich500manUnregistered')` のフィルタが常に0件を返す。

修正方針は最小限の変更：`BUYER_COLUMNS` への1カラム追加と、`property_listings` クエリへの
`price` カラム追加、および `propertyMap` への `price` マッピング追加の3点のみ。

## Glossary

- **Bug_Condition (C)**: `fetchAllBuyers()` が `pinrich_500man_registration` と `inquiry_property_price` を取得できていない状態でフィルタが実行されること
- **Property (P)**: `getBuyersByStatus('pinrich500manUnregistered')` が正しい条件（email非空 AND price≤500万 AND pinrich_500man_registration未 AND reception_date≥2026-01-01）で買主を返すこと
- **Preservation**: `fetchAllBuyers()` を使用する他の全カテゴリのフィルタリング動作が変わらないこと
- **fetchAllBuyers**: `backend/src/services/BuyerService.ts` の private メソッド。全買主を1000件制限を回避して全件取得し、`property_listings` の情報を付与して返す
- **BUYER_COLUMNS**: `fetchAllBuyers()` 内で定義されるカラムリスト。`select('*')` の代わりに必要カラムのみ指定してパフォーマンスを最適化している
- **fetchBuyersForSidebarCounts**: サイドバーカウント計算専用の別メソッド。こちらには既に `pinrich_500man_registration` と `price` が含まれており、バグの影響を受けない
- **inquiry_property_price**: `property_listings.price` を買主オブジェクトに付与したフィールド名。`getBuyersByStatus` のフィルタ条件で使用される

## Bug Details

### Bug Condition

`getBuyersByStatus('pinrich500manUnregistered')` は `fetchAllBuyersWithStatus()` →
`fetchAllBuyers()` の結果を使ってフィルタリングを行う。しかし `fetchAllBuyers()` の
`BUYER_COLUMNS` に `pinrich_500man_registration` が含まれておらず、また
`property_listings` クエリに `price` が含まれていないため、フィルタ条件の2つの変数が
常に期待値を持たない状態になる。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer オブジェクト（fetchAllBuyers()の返り値）
  OUTPUT: boolean

  RETURN buyer.pinrich_500man_registration === undefined  // BUYER_COLUMNSに含まれていない
         AND buyer.inquiry_property_price === undefined   // property_listingsにpriceが含まれていない
END FUNCTION
```

### Examples

- **例1（バグあり）**: email='test@example.com'、物件価格300万円、pinrich_500man_registration='未'、reception_date='2026-03-01' の買主
  - 期待: フィルタ結果に含まれる
  - 実際: `buyer.inquiry_property_price` が `undefined` → `Number(undefined) <= 5000000` が `false` → 除外される

- **例2（バグあり）**: email='test@example.com'、物件価格300万円、pinrich_500man_registration=null、reception_date='2026-03-01' の買主
  - 期待: フィルタ結果に含まれる
  - 実際: 同上、0件が返る

- **例3（影響なし）**: `fetchBuyersForSidebarCounts()` 経由のサイドバーカウント表示
  - こちらは既に `pinrich_500man_registration` と `price` を取得しているため正常動作

- **エッジケース**: `property_number` が空の買主（物件未紐付け）
  - `inquiry_property_price` は `undefined` のまま → フィルタ条件 `buyer.inquiry_property_price !== undefined` で除外される（正しい動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `fetchAllBuyers()` を使用する他の全サイドバーカテゴリ（当日TEL、３回架電未、担当別等）のフィルタリング結果は変わらない
- `fetchBuyersForSidebarCounts()` は変更しないため、サイドバーのカウント数表示は影響を受けない
- `pinrich_500man_registration` が `'済'` の買主は引き続き「Pinrich500万以上登録未」に含まれない
- `inquiry_property_price` が500万円を超える買主は引き続き除外される
- `email` が空の買主は引き続き除外される
- `reception_date` が `'2026-01-01'` より前の買主は引き続き除外される

**Scope:**
`pinrich500manUnregistered` 以外のステータスカテゴリに対するフィルタリングは
完全に影響を受けない。`BUYER_COLUMNS` へのカラム追加は読み取り専用の変更であり、
既存カラムの取得には影響しない。

## Hypothesized Root Cause

1. **BUYER_COLUMNS からの `pinrich_500man_registration` 欠落**:
   - `fetchAllBuyers()` はパフォーマンス最適化のため `select('*')` ではなく必要カラムのみを指定している
   - `pinrich_500man_registration` カラムが後から追加されたが、`BUYER_COLUMNS` リストへの追加が漏れた
   - 結果: `buyer.pinrich_500man_registration` が常に `undefined`

2. **`property_listings` クエリからの `price` 欠落**:
   - `fetchAllBuyers()` の `property_listings` クエリは `property_number, atbb_status, address, sales_assignee, property_type` のみ取得
   - `price` カラムが含まれていないため `propertyMap` に `price` が格納されない
   - 結果: `buyer.inquiry_property_price` が常に `undefined`（`propertyMap` に `price` キーがないため）

3. **`fetchBuyersForSidebarCounts()` との非対称性**:
   - サイドバーカウント専用の `fetchBuyersForSidebarCounts()` には両方のカラムが正しく含まれている
   - `fetchAllBuyers()` は別途メンテナンスされており、同期が取れていなかった

## Correctness Properties

Property 1: Bug Condition - Pinrich500万以上登録未フィルタが正しく機能する

_For any_ 買主データにおいて、`isBugCondition` が true（`pinrich_500man_registration` と
`inquiry_property_price` が正しく取得されている）の場合、修正後の
`getBuyersByStatus('pinrich500manUnregistered')` は以下の4条件を全て満たす買主のみを返す SHALL：
- `email` が空でない
- `inquiry_property_price` が500万円以下
- `pinrich_500man_registration` が `null`、空文字、または `'未'`
- `reception_date` が `'2026-01-01'` 以降

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他カテゴリのフィルタリング動作が変わらない

_For any_ `pinrich500manUnregistered` 以外のステータスカテゴリに対して、修正後の
`getBuyersByStatus()` は修正前と同一の結果を返す SHALL。`BUYER_COLUMNS` への
カラム追加は既存カラムの取得に影響を与えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Function**: `fetchAllBuyers()` (private)

**Specific Changes**:

1. **`BUYER_COLUMNS` に `pinrich_500man_registration` を追加**:
   ```typescript
   // 変更前
   'day_of_week', 'pinrich', 'email_confirmed', 'email_confirmation_assignee',
   
   // 変更後
   'day_of_week', 'pinrich', 'pinrich_500man_registration', 'email_confirmed', 'email_confirmation_assignee',
   ```

2. **`property_listings` クエリに `price` を追加**:
   ```typescript
   // 変更前
   .select('property_number, atbb_status, address, sales_assignee, property_type'),
   
   // 変更後
   .select('property_number, atbb_status, address, sales_assignee, property_type, price'),
   ```

3. **`propertyMap` の型定義と値に `price` を追加**:
   ```typescript
   // 変更前
   const propertyMap: Record<string, { atbb_status: string; property_address: string | null; sales_assignee: string | null; property_type: string | null }> = {};
   // ...
   propertyMap[listing.property_number] = {
     atbb_status: listing.atbb_status || '',
     property_address: listing.address ?? null,
     sales_assignee: listing.sales_assignee ?? null,
     property_type: listing.property_type ?? null,
   };
   
   // 変更後
   const propertyMap: Record<string, { atbb_status: string; property_address: string | null; sales_assignee: string | null; property_type: string | null; price: number | null }> = {};
   // ...
   propertyMap[listing.property_number] = {
     atbb_status: listing.atbb_status || '',
     property_address: listing.address ?? null,
     sales_assignee: listing.sales_assignee ?? null,
     property_type: listing.property_type ?? null,
     price: listing.price ?? null,
   };
   ```

4. **各買主への `inquiry_property_price` 付与を追加**:
   ```typescript
   // 変更前
   return {
     ...buyer,
     atbb_status: prop?.atbb_status || '',
     property_address: prop?.property_address ?? null,
     property_sales_assignee: prop?.sales_assignee ?? null,
     property_type: prop?.property_type ?? null,
   };
   
   // 変更後
   return {
     ...buyer,
     atbb_status: prop?.atbb_status || '',
     property_address: prop?.property_address ?? null,
     property_sales_assignee: prop?.sales_assignee ?? null,
     property_type: prop?.property_type ?? null,
     inquiry_property_price: prop?.price ?? null,
   };
   ```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書いてフィルタが0件を返すことを確認し、
次に修正後のコードで正しい件数が返ることと他カテゴリへの影響がないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `fetchAllBuyers()` のモックを使って `getBuyersByStatus('pinrich500manUnregistered')` を
呼び出し、`pinrich_500man_registration` と `inquiry_property_price` が欠落した状態でフィルタが
0件を返すことを確認する。

**Test Cases**:
1. **カラム欠落テスト**: `pinrich_500man_registration` を含まない買主データでフィルタを実行 → 0件が返ることを確認（未修正コードで失敗）
2. **price欠落テスト**: `inquiry_property_price` が `undefined` の買主データでフィルタを実行 → 0件が返ることを確認（未修正コードで失敗）
3. **両方欠落テスト**: 両カラムが欠落した状態でフィルタを実行 → 0件が返ることを確認（未修正コードで失敗）
4. **エッジケーステスト**: `property_number` が空の買主（物件未紐付け）→ `inquiry_property_price` が `undefined` のため除外される（正しい動作）

**Expected Counterexamples**:
- 条件を満たすはずの買主が0件返る
- 原因: `buyer.inquiry_property_price` が `undefined` → `Number(undefined) <= 5000000` が `false`

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := getBuyersByStatus_fixed('pinrich500manUnregistered')
  ASSERT result.data に buyer が含まれる（4条件を全て満たす場合）
  ASSERT result.data に buyer が含まれない（4条件のいずれかを満たさない場合）
END FOR
```

### Preservation Checking

**Goal**: 修正後、`pinrich500manUnregistered` 以外の全カテゴリで動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL status WHERE status !== 'pinrich500manUnregistered' DO
  ASSERT getBuyersByStatus_original(status) = getBuyersByStatus_fixed(status)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様な買主データを自動生成して全カテゴリを網羅できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存カテゴリへの影響がないことを強く保証できる

**Test Cases**:
1. **当日TELカテゴリ保全**: 修正前後で当日TELフィルタ結果が同一であることを確認
2. **担当別カテゴリ保全**: 修正前後で担当別フィルタ結果が同一であることを確認
3. **３回架電未カテゴリ保全**: 修正前後で３回架電未フィルタ結果が同一であることを確認

### Unit Tests

- `fetchAllBuyers()` が `pinrich_500man_registration` を含む買主データを返すことを確認
- `fetchAllBuyers()` が `inquiry_property_price` を含む買主データを返すことを確認
- `getBuyersByStatus('pinrich500manUnregistered')` が4条件を全て満たす買主のみを返すことを確認
- 各条件の境界値テスト（price=5000000、price=5000001、reception_date='2026-01-01'等）

### Property-Based Tests

- ランダムな買主データを生成し、4条件を満たす買主が全て結果に含まれることを確認
- ランダムな買主データを生成し、4条件のいずれかを満たさない買主が結果に含まれないことを確認
- `pinrich500manUnregistered` 以外のカテゴリで、修正前後の結果が一致することを確認

### Integration Tests

- 実際のSupabaseデータを使って `getBuyersByStatus('pinrich500manUnregistered')` が1件以上返すことを確認
- サイドバーカウント（`fetchBuyersForSidebarCounts` 経由）と `getBuyersByStatus` の結果件数が一致することを確認
- 他のサイドバーカテゴリが修正後も正常に動作することを確認
